"""Sanitized backbone definitions imported from the ablation experiment folder.
Generated for AresVision training; top-level experiment runners are intentionally omitted.
"""
import torch
import torch.nn as nn

class CausalLSTMCell(nn.Module):
    """
    PredRNN++ causal LSTM cell.
    The cell logic is kept unchanged so the dual-stream modification only
    happens at the input adapter in front of the recurrent stack.
    """

    def __init__(self, input_dim, hidden_dim, memory_dim, filter_size=3):
        super().__init__()
        padding = filter_size // 2
        self.hidden_dim = hidden_dim
        self.conv_x = nn.Conv2d(input_dim, hidden_dim * 7, filter_size, padding=padding)
        self.conv_h = nn.Conv2d(hidden_dim, hidden_dim * 4, filter_size, padding=padding)
        self.conv_c = nn.Conv2d(hidden_dim, hidden_dim * 3, filter_size, padding=padding)
        self.conv_m = nn.Conv2d(memory_dim, hidden_dim * 3, filter_size, padding=padding)
        self.conv_c2m = nn.Conv2d(hidden_dim, hidden_dim * 4, filter_size, padding=padding)
        self.conv_m2o = nn.Conv2d(hidden_dim, hidden_dim, filter_size, padding=padding)
        self.conv_mem = nn.Conv2d(hidden_dim * 2, hidden_dim, kernel_size=1)

    def forward(self, x, h, c, m):
        x_concat = self.conv_x(x)
        h_concat = self.conv_h(h)
        c_concat = self.conv_c(c)
        m_concat = self.conv_m(m)
        (i_x, g_x, f_x, o_x, i_xp, g_xp, f_xp) = torch.split(x_concat, self.hidden_dim, dim=1)
        (i_h, g_h, f_h, o_h) = torch.split(h_concat, self.hidden_dim, dim=1)
        (i_c, g_c, f_c) = torch.split(c_concat, self.hidden_dim, dim=1)
        (i_m, f_m, m_m) = torch.split(m_concat, self.hidden_dim, dim=1)
        i_t = torch.sigmoid(i_x + i_h + i_c)
        f_t = torch.sigmoid(f_x + f_h + f_c + 1.0)
        g_t = torch.tanh(g_x + g_h + g_c)
        c_new = f_t * c + i_t * g_t
        c2m_concat = self.conv_c2m(c_new)
        (i_c2m, g_c2m, f_c2m, o_c) = torch.split(c2m_concat, self.hidden_dim, dim=1)
        i_tp = torch.sigmoid(i_c2m + i_xp + i_m)
        f_tp = torch.sigmoid(f_c2m + f_xp + f_m + 1.0)
        g_tp = torch.tanh(g_c2m + g_xp)
        m_new = f_tp * torch.tanh(m_m) + i_tp * g_tp
        o_m = self.conv_m2o(m_new)
        o_t = torch.tanh(o_x + o_h + o_c + o_m)
        merged_memory = torch.cat([c_new, m_new], dim=1)
        cell = self.conv_mem(merged_memory)
        h_new = o_t * torch.tanh(cell)
        return (h_new, c_new, m_new)

class PredRNN_DualStream(nn.Module):
    """
    Dual-stream PredRNN front-end for Mars ozone hysteresis modeling.

    Input channel order:
        [O3, AT, T, dT]

    Slow branch:
        [O3, AT] -> 7x7 conv -> 64 channels

    Fast branch:
        [T, dT] -> 3x3 conv -> 16 channels

    After concatenation, a 1x1 convolution compresses 80 channels back to
    the recurrent input_dim required by the unchanged causal LSTM backbone.
    """

    def __init__(self, input_dim=64, num_layers=3, num_hidden=None, horizon=3, slow_branch_channels=64, fast_branch_channels=16, cell_filter_size=3):
        super().__init__()
        if num_hidden is None:
            num_hidden = [64] * num_layers
        elif isinstance(num_hidden, int):
            num_hidden = [num_hidden] * num_layers
        else:
            num_hidden = list(num_hidden)
        if len(num_hidden) != num_layers:
            raise ValueError('len(num_hidden) must equal num_layers.')
        self.input_dim = input_dim
        self.num_layers = num_layers
        self.num_hidden = num_hidden
        self.horizon = horizon
        self.slow_branch = nn.Sequential(nn.Conv2d(2, slow_branch_channels, kernel_size=7, padding=3), nn.ReLU(inplace=True))
        self.fast_branch = nn.Sequential(nn.Conv2d(2, fast_branch_channels, kernel_size=3, padding=1), nn.ReLU(inplace=True))
        self.fusion_proj = nn.Sequential(nn.Conv2d(slow_branch_channels + fast_branch_channels, input_dim, kernel_size=1), nn.ReLU(inplace=True))
        self.cells = nn.ModuleList()
        for layer_idx in range(num_layers):
            current_input_dim = input_dim if layer_idx == 0 else num_hidden[layer_idx - 1]
            current_memory_dim = num_hidden[-1] if layer_idx == 0 else num_hidden[layer_idx - 1]
            self.cells.append(CausalLSTMCell(input_dim=current_input_dim, hidden_dim=num_hidden[layer_idx], memory_dim=current_memory_dim, filter_size=cell_filter_size))
        self.conv_last = nn.Conv2d(num_hidden[-1], 1, kernel_size=1)

    def forward(self, x):
        """
        Args:
            x: Tensor with shape [B, T, 4, H, W], channel order [O3, AT, T, dT].

        Returns:
            Tensor with shape [B, horizon, 1, H, W].
        """
        if x.ndim != 5:
            raise ValueError('Expected input shape [B, T, C, H, W].')
        (batch_size, seq_len, channels, height, width) = x.shape
        if channels != 4:
            raise ValueError('PredRNN_DualStream expects 4 input channels: [O3, AT, T, dT].')
        x_2d = x.reshape(batch_size * seq_len, channels, height, width)
        slow_input = x_2d[:, 0:2]
        fast_input = x_2d[:, 2:4]
        slow_feat = self.slow_branch(slow_input)
        fast_feat = self.fast_branch(fast_input)
        fused_feat = self.fusion_proj(torch.cat([slow_feat, fast_feat], dim=1))
        fused_feat = fused_feat.view(batch_size, seq_len, self.input_dim, height, width)
        h_states = [torch.zeros(batch_size, hidden_dim, height, width, device=x.device) for hidden_dim in self.num_hidden]
        c_states = [torch.zeros_like(h_state) for h_state in h_states]
        memory = torch.zeros(batch_size, self.num_hidden[-1], height, width, device=x.device)
        for time_idx in range(seq_len):
            current = fused_feat[:, time_idx]
            for (layer_idx, cell) in enumerate(self.cells):
                (h_next, c_next, memory) = cell(current, h_states[layer_idx], c_states[layer_idx], memory)
                h_states[layer_idx] = h_next
                c_states[layer_idx] = c_next
                current = h_next
        preds = []
        decoder_input = fused_feat[:, -1]
        for _ in range(self.horizon):
            current = decoder_input
            for (layer_idx, cell) in enumerate(self.cells):
                (h_next, c_next, memory) = cell(current, h_states[layer_idx], c_states[layer_idx], memory)
                h_states[layer_idx] = h_next
                c_states[layer_idx] = c_next
                current = h_next
            preds.append(self.conv_last(h_states[-1]))
        return torch.stack(preds, dim=1)
