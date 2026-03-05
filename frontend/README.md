

# AresVision 智绘赤星 — 前端本地运行指南

---

## 环境准备（只需一次）

### 1. 安装 Node.js

前往 https://nodejs.org 下载 **LTS 版本**（≥18），安装后打开终端验证：

```bash
node --version    # 应显示 v18.x.x 或更高
npm --version     # 应显示 9.x.x 或更高
```

### 2. 在 PyCharm 中打开项目

1. 用 PyCharm 打开整个 `AresVision/` 目录
2. PyCharm 会自动识别 `frontend/` 为前端子项目
3. 建议安装 PyCharm 的 **JavaScript and TypeScript** 插件（通常自带）

---

## 启动前端（每次开发时）

打开 PyCharm 的 **Terminal**（底部面板），执行：

```bash
# 1. 进入前端目录
cd frontend

# 2. 首次运行需安装依赖（之后不用重复）
npm install

# 3. 启动开发服务器
npm run dev
```

你会看到类似输出：

```
  VITE v6.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

**浏览器打开 http://localhost:5173 即可看到页面。**

修改任何 `.jsx` 文件后保存，浏览器会自动热更新，无需手动刷新。

---

## 项目结构说明

```
AresVision/
├── backend/                     ← 你已有的 FastAPI 后端（未来放这里）
│
└── frontend/                    ← React 前端
    ├── index.html               ← HTML 入口
    ├── package.json             ← 依赖声明
    ├── vite.config.js           ← Vite 配置（含后端代理）
    ├── tailwind.config.js       ← Tailwind 主题配置
    ├── postcss.config.js
    └── src/
        ├── main.jsx             ← 应用挂载点（不需要改）
        ├── App.jsx              ← 根组件：导航 + 页面切换
        ├── index.css            ← 全局样式 + 动画
        │
        ├── constants/
        │   └── colors.js        ← 颜色 Token（改这里影响全局配色）
        │
        ├── components/          ← 通用 UI 组件
        │   ├── Navbar.jsx           导航栏
        │   ├── StarField.jsx        星空背景
        │   ├── GlowCard.jsx         发光卡片
        │   ├── SectionTitle.jsx     区块标题
        │   ├── ChartPlaceholder.jsx 图表占位符（后续替换为 Plotly/Globe）
        │   └── Mars3DPlaceholder.jsx CSS 火星球体
        │
        ├── pages/               ← 页面组件（每个页面一个文件）
        │   ├── HomePage.jsx         首页（3D 火星 + 动画）
        │   ├── ExplorePage.jsx      数据探索
        │   ├── PredictPage.jsx      预测分析
        │   ├── AIPage.jsx           AI 解读
        │   └── AboutPage.jsx        关于
        │
        ├── contexts/            ← 全局状态（未来添加）
        │   └── DataContext.jsx
        │
        └── services/
            └── api.js           ← 后端 API 封装（未来对接后端改这里）
```

---

## 后续对接后端

`vite.config.js` 已配置代理：前端所有 `/api/*` 请求会自动转发到 `http://localhost:8000`。

也就是说：
- 前端代码里写 `fetch('/api/map/demo?my=27&ls=10')`
- Vite 会自动把请求发到你的 FastAPI `http://localhost:8000/api/map/demo?my=27&ls=10`

**开发时需要同时运行两个终端：**
- 终端 1：`cd backend && uvicorn main:app --reload`（后端）
- 终端 2：`cd frontend && npm run dev`（前端）

---

## 常见问题

**Q: `npm install` 报错？**
A: 确认 Node.js 版本 ≥ 18。用 `node --version` 检查。

**Q: 页面空白？**
A: 打开浏览器 F12 控制台看报错信息。

**Q: 如何替换占位符为真实图表？**
A: 在对应页面文件中，把 `<ChartPlaceholder>` 替换为 Plotly 或 react-globe.gl 组件，数据从 `services/api.js` 获取。

**Q: 如何加新页面？**
A: 在 `pages/` 下创建新文件，然后在 `App.jsx` 中添加路由条件和 `Navbar.jsx` 中添加导航项。
