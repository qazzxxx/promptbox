# 云词 - 云际片语，点石成金

云词是一款专业的 AI 提示词 (Prompt) 管理与优化工具，旨在帮助用户高效地存储、分类、调试和优化各类 AI 模型（如 GPT-4, Claude, Midjourney 等）的提示词。

## 🌟 核心功能

- **🚀 提示词工作坊**：实时编辑、调试提示词，支持变量定义（`{{variable}}`）和实时预览。
- **🤖 AI 智能解析**：直接粘贴一段提示词，AI 会自动为您分析并填充标题、描述和标签。
- **🪄 AI 自动优化**：内置专业提示词工程师指令，一键将简短的 Prompt 优化为高质量、结构化的指令。
- **📁 多维管理**：支持自定义分类、多标签管理，并提供收藏夹功能，方便快速查找。
- **🌗 全能主题**：完美适配浅色与深色模式，提供舒适的视觉体验。
- **📱 响应式设计**：极简现代的 UI 风格，流畅的交互体验。

## 🛠️ 技术栈

### 前端 (Frontend)
- **框架**: React 18
- **UI 组件库**: Ant Design (v6)
- **状态管理**: Zustand
- **编辑器**: react-simple-code-editor + Prism.js
- **构建工具**: Vite

### 后端 (Backend)
- **框架**: FastAPI
- **数据库**: SQLModel (SQLite)
- **AI 集成**: OpenAI SDK (兼容各类 OpenAI 格式接口)
- **环境**: Python 3.8+

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd cloudprompts
```

### 2. 后端配置与启动
```bash
cd backend
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate
# 安装依赖
pip install -r requirements.txt
# 启动服务 (默认 8000 端口)
uvicorn main:app --reload --port 8000
```

### 3. 前端配置与启动
```bash
cd frontend
# 安装依赖
npm install
# 启动开发服务器
npm run dev
```

### 4. 初始配置
启动应用后，请前往 **设置** 页面配置您的 AI 服务商信息（API Key 和 Base URL），以便使用 AI 解析和优化功能。

## 📂 项目结构

```text
cloudprompts/
├── frontend/             # 前端 React 源代码
│   ├── src/
│   │   ├── api/         # 接口定义
│   │   ├── components/  # 核心 UI 组件
│   │   └── App.jsx      # 主应用入口
├── backend/              # 后端 FastAPI 源代码
│   ├── main.py          # 路由与业务逻辑
│   ├── models.py        # 数据库模型
│   └── requirements.txt # Python 依赖
└── README.md
```

## 📄 开源协议

[MIT License](LICENSE)
