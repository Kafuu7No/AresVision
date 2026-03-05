"""
PredRNNv2 模型定义
时空 LSTM 网络，用于火星臭氧柱浓度的时空序列预测。

架构: 多层 SpatioTemporal LSTM (ST-LSTM) + 解耦记忆模块
输入: (batch, seq_len, channels, height, width)
输出: (batch, horizon, 1, height, width)  — 仅预测臭氧通道
"""

import torch
import torch.nn as nn


class SpatioTemporalLSTMCell(nn.Module):
    """
    PredRNNv2 的核心单元：时空 LSTM Cell
    相比标准 ConvLSTM，增加了 Spatiotemporal Memory (M) 在层间传递。
    """

    def __init__(self, in_channel, num_hidden, height, width,
                 filter_size, stride, layer_norm=True):
        super().__init__()

        self.num_hidden = num_hidden
        self.padding = filter_size // 2

        # 标准 LSTM 门 + M 记忆门 (共 7 组卷积)
        # 输入门 i, 遗忘门 f, 输出门 o, 候选状态 g,
        # M记忆的 i', f', g'
        self.conv_x = nn.Sequential(
            nn.Conv2d(in_channel, num_hidden * 7, filter_size,
                      stride=stride, padding=self.padding, bias=False),
        )
        self.conv_h = nn.Sequential(
            nn.Conv2d(num_hidden, num_hidden * 4, filter_size,
                      stride=stride, padding=self.padding, bias=False),
        )
        self.conv_m = nn.Sequential(
            nn.Conv2d(num_hidden, num_hidden * 3, filter_size,
                      stride=stride, padding=self.padding, bias=False),
        )
        self.conv_o = nn.Sequential(
            nn.Conv2d(num_hidden * 2, num_hidden, filter_size,
                      stride=stride, padding=self.padding, bias=False),
        )

        if layer_norm:
            self.layer_norm = nn.LayerNorm([num_hidden, height, width])
        else:
            self.layer_norm = None

    def forward(self, x_t, h_t, c_t, m_t):
        """
        Args:
            x_t: 输入, (batch, in_channel, H, W)
            h_t: 隐藏状态, (batch, num_hidden, H, W)
            c_t: Cell 状态, (batch, num_hidden, H, W)
            m_t: 时空记忆, (batch, num_hidden, H, W)

        Returns:
            h_next, c_next, m_next
        """
        x_concat = self.conv_x(x_t)
        h_concat = self.conv_h(h_t)
        m_concat = self.conv_m(m_t)

        # 拆分 x 的 7 组
        i_x, f_x, g_x, o_x, i_x_m, f_x_m, g_x_m = torch.split(
            x_concat, self.num_hidden, dim=1
        )
        # 拆分 h 的 4 组
        i_h, f_h, g_h, o_h = torch.split(h_concat, self.num_hidden, dim=1)
        # 拆分 m 的 3 组
        i_m, f_m, g_m = torch.split(m_concat, self.num_hidden, dim=1)

        # 标准 LSTM 更新
        i_t = torch.sigmoid(i_x + i_h)
        f_t = torch.sigmoid(f_x + f_h)
        g_t = torch.tanh(g_x + g_h)
        c_next = f_t * c_t + i_t * g_t

        # 时空记忆 M 更新
        i_t_m = torch.sigmoid(i_x_m + i_m)
        f_t_m = torch.sigmoid(f_x_m + f_m)
        g_t_m = torch.tanh(g_x_m + g_m)
        m_next = f_t_m * m_t + i_t_m * g_t_m

        # 输出门融合 C 和 M
        o_t = torch.sigmoid(
            o_x + o_h + self.conv_o(torch.cat([c_next, m_next], dim=1))
        )

        h_next = o_t * torch.tanh(c_next + m_next)

        if self.layer_norm is not None:
            h_next = self.layer_norm(h_next)

        return h_next, c_next, m_next


class PredRNNv2(nn.Module):
    """
    PredRNNv2 完整网络
    支持动态输入通道数（通过 zero masking 实现）
    """

    def __init__(self, num_layers, num_hidden, configs):
        """
        Args:
            num_layers: ST-LSTM 层数
            num_hidden: list, 每层隐藏单元数
            configs: dict, 包含 total_channels, img_height, img_width,
                     filter_size, stride, layer_norm, patch_size 等
        """
        super().__init__()

        self.num_layers = num_layers
        self.num_hidden = num_hidden
        self.configs = configs

        C = configs["total_channels"]
        H = configs["img_height"]
        W = configs["img_width"]
        self.height = H
        self.width = W

        filter_size = configs.get("filter_size", 5)
        stride = configs.get("stride", 1)
        layer_norm = configs.get("layer_norm", True)

        # 构建多层 ST-LSTM
        cell_list = []
        for i in range(num_layers):
            in_channel = C if i == 0 else num_hidden[i - 1]
            cell_list.append(
                SpatioTemporalLSTMCell(
                    in_channel, num_hidden[i], H, W,
                    filter_size, stride, layer_norm,
                )
            )
        self.cell_list = nn.ModuleList(cell_list)

        # 输出层：将最后一层隐藏映射到 1 通道（仅预测臭氧）
        self.conv_last = nn.Conv2d(
            num_hidden[-1], 1, kernel_size=1, padding=0, bias=True
        )

        # 通道适配层：将动态输入通道映射到固定 total_channels
        # 这样无论选了几个变量，都能喂给模型
        self.input_adapter = nn.Conv2d(C, C, kernel_size=1, bias=False)
        nn.init.eye_(self.input_adapter.weight[:, :, 0, 0])

    def forward(self, input_tensor, channel_mask=None):
        """
        Args:
            input_tensor: (batch, seq_len, total_channels, H, W)
            channel_mask: (total_channels,) 的 0/1 张量，
                          1=启用, 0=被 mask。None 表示全部启用。

        Returns:
            pred: (batch, pred_horizon, 1, H, W)
        """
        batch, seq_len, C, H, W = input_tensor.shape
        device = input_tensor.device

        horizon = self.configs.get("pred_horizon", 3)
        total_len = seq_len + horizon

        # 应用通道 mask（零值掩码方案）
        if channel_mask is not None:
            mask = channel_mask.view(1, 1, C, 1, 1).to(device)
            input_tensor = input_tensor * mask

        # 初始化隐藏状态
        h_t = [torch.zeros(batch, self.num_hidden[i], H, W, device=device)
               for i in range(self.num_layers)]
        c_t = [torch.zeros(batch, self.num_hidden[i], H, W, device=device)
               for i in range(self.num_layers)]
        m_t = torch.zeros(batch, self.num_hidden[0], H, W, device=device)

        predictions = []

        for t in range(total_len):
            if t < seq_len:
                # 编码阶段：使用真实输入
                x_t = input_tensor[:, t]
            else:
                # 预测阶段：自回归（仅臭氧通道有输出，其他通道用最后已知值）
                x_t = self._build_autoregressive_input(
                    pred_o3, input_tensor[:, -1], channel_mask, device
                )

            # 逐层前向
            for i in range(self.num_layers):
                if i == 0:
                    h_t[i], c_t[i], m_t = self.cell_list[i](
                        x_t, h_t[i], c_t[i], m_t
                    )
                else:
                    h_t[i], c_t[i], m_t = self.cell_list[i](
                        h_t[i - 1], h_t[i], c_t[i], m_t
                    )

            # 生成预测
            pred_o3 = self.conv_last(h_t[-1])  # (batch, 1, H, W)

            if t >= seq_len:
                predictions.append(pred_o3)

        # (batch, horizon, 1, H, W)
        return torch.stack(predictions, dim=1)

    def _build_autoregressive_input(self, pred_o3, last_known_input,
                                     channel_mask, device):
        """
        构建自回归阶段的输入：
        - 第 0 通道（O₃）使用上一步的预测输出
        - 其余通道使用最后已知的环境变量值
        """
        batch, C, H, W = last_known_input.shape
        x = last_known_input.clone()
        x[:, 0:1] = pred_o3  # 替换臭氧通道

        if channel_mask is not None:
            mask = channel_mask.view(1, C, 1, 1).to(device)
            x = x * mask

        return x
