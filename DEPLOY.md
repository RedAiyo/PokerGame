# 德州扑克 - Vercel 部署指南

本文档详细说明如何将德州扑克项目部署到 **Vercel**（前端 + Serverless API）+ **Supabase**（数据库 + 认证 + 实时通信）。

---

## 架构说明

| 层 | 技术 | 部署位置 |
|---|------|---------|
| 前端 | React + Vite | Vercel 静态托管 |
| API | Express → Vercel Serverless Functions | Vercel `/api` 路由 |
| 数据库 | PostgreSQL | Supabase |
| 认证 | Supabase Auth | Supabase |
| 实时通信 | Supabase Realtime (Broadcast) | Supabase |

> **注意**: Vercel Serverless Functions 是无状态的，每次请求都是独立调用。游戏引擎的内存状态（`GameManager`）在 Serverless 环境中**无法持久化**。生产环境建议将游戏状态存入 Supabase 数据库或 Redis，而非内存。当前实现适合演示和开发阶段。

---

## 前置条件

- [Node.js](https://nodejs.org/) 18+
- [GitHub](https://github.com) 账号
- [Vercel](https://vercel.com) 账号（可用 GitHub 登录）
- [Supabase](https://supabase.com) 账号

---

## 第一步：配置 Supabase

### 1.1 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 点击 **New Project**
3. 填写：
   - **Project name**: `pokergame`（或任意名称）
   - **Database Password**: 设一个强密码（记下来）
   - **Region**: 选离你最近的区域
4. 点击 **Create new project**，等待创建完成

### 1.2 执行数据库迁移

1. 在 Supabase Dashboard 左侧栏点击 **SQL Editor**
2. 点击 **New query**
3. 将 `supabase/migrations/001_initial_schema.sql` 的全部内容粘贴进去
4. 点击 **Run** 执行
5. 确认无报错（应看到 "Success. No rows returned"）

### 1.3 获取密钥

在 Supabase Dashboard → **Settings** → **API** 页面，记下以下值：

| 名称 | 位置 | 用途 |
|------|------|------|
| **Project URL** | `https://xxxxx.supabase.co` | 前后端连接 |
| **anon public key** | `eyJhbG...` | 前端使用 |
| **service_role key** | `eyJhbG...` | 后端使用（**绝不暴露到前端**） |

### 1.4 配置认证（可选）

在 **Authentication** → **Providers** 中：
- 确保 **Email** 认证已启用
- 可选关闭 **Confirm email**（开发阶段方便测试）

---

## 第二步：推送代码到 GitHub

如果还没有推送到 GitHub：

```bash
# 在 pokergame 目录下
git remote add origin https://github.com/你的用户名/pokergame.git
git push -u origin main
```

---

## 第三步：部署到 Vercel

### 3.1 导入项目

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New...** → **Project**
3. 在 **Import Git Repository** 中找到 `pokergame` 仓库并点击 **Import**

### 3.2 配置构建设置

Vercel 会自动检测 Vite 框架。确认以下设置：

| 设置项 | 值 |
|--------|-----|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

> 这些设置已在 `vercel.json` 中定义，通常会被自动识别。

### 3.3 配置环境变量

在 **Environment Variables** 部分，添加以下 4 个变量：

| Key | Value | 说明 |
|-----|-------|------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | 前端 Supabase 连接 |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` (anon key) | 前端 Supabase 认证 |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | 后端 Supabase 连接 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` (service_role key) | 后端管理权限 |

> **重要**: `VITE_` 前缀的变量会被打包到前端代码中，所以只放 anon key。`SUPABASE_SERVICE_ROLE_KEY` 绝不加 `VITE_` 前缀。

### 3.4 部署

点击 **Deploy**，等待构建完成。

部署成功后，你会得到一个 URL，如 `https://pokergame-xxx.vercel.app`。

---

## 第四步：验证部署

### 4.1 测试健康检查

访问 `https://你的域名/api/health`，应返回：

```json
{ "status": "ok", "timestamp": "2026-03-04T..." }
```

### 4.2 测试注册/登录

1. 打开 `https://你的域名`
2. 应看到登录/注册页面
3. 注册一个新账号
4. 登录后进入主菜单

### 4.3 测试完整流程

1. 打开两个浏览器窗口（或一个隐身窗口）
2. 分别登录两个账号
3. 创建房间 → 另一账号加入 → 开始游戏

---

## 项目文件结构说明

```
pokergame/
├── vercel.json          # Vercel 部署配置
├── api/
│   └── index.ts         # Serverless Function 入口（包装 Express）
├── server/              # Express 后端（被 api/index.ts 导入）
│   ├── index.ts         # Express app（Vercel 环境下不监听端口）
│   ├── config/          # Supabase 客户端配置
│   ├── middleware/       # 认证、错误处理中间件
│   ├── routes/          # API 路由
│   ├── engine/          # 游戏引擎
│   └── realtime/        # 实时广播
├── src/                 # React 前端
├── supabase/
│   └── migrations/      # 数据库迁移 SQL
└── dist/                # Vite 构建输出（自动生成）
```

---

## 关键配置文件

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" }
  ],
  "functions": {
    "api/index.ts": {
      "runtime": "@vercel/node@3"
    }
  }
}
```

- `rewrites`: 将所有 `/api/*` 请求路由到 Serverless Function
- `functions`: 指定 `api/index.ts` 使用 Node.js 运行时

### api/index.ts

```typescript
import app from '../server/index.js';
export default app;
```

这个文件将 Express app 导出为 Vercel Serverless Function handler。

---

## 自定义域名（可选）

1. 在 Vercel Dashboard → 你的项目 → **Settings** → **Domains**
2. 添加你的域名（如 `poker.example.com`）
3. 按提示在你的 DNS 服务商添加 CNAME 或 A 记录
4. 等待 DNS 生效（通常几分钟到几小时）

---

## 环境变量管理

### 本地开发

在项目根目录创建 `.env` 文件：

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

然后运行：

```bash
npm run dev:all
```

这会同时启动 Vite 开发服务器（3000 端口）和 Express 后端（3001 端口），Vite 自动代理 `/api` 请求到后端。

### 生产环境（Vercel）

所有环境变量在 Vercel Dashboard 中配置，不需要 `.env` 文件。

---

## 常见问题

### Q: 访问 /api/* 返回 404

检查 `vercel.json` 中的 `rewrites` 配置是否正确，确保 `api/index.ts` 文件存在。

### Q: API 返回 500 "Internal server error"

检查 Vercel 的 Function Logs（Dashboard → 项目 → **Logs**），通常是环境变量未配置或 Supabase 连接失败。

### Q: 注册后无法登录

1. 检查 Supabase 是否开启了邮箱确认（开发阶段建议关闭）
2. 检查 SQL 迁移是否成功执行（`profiles` 表和触发器是否存在）

### Q: 游戏状态在刷新后丢失

这是 Serverless 环境的限制。`GameManager` 使用内存存储，每次函数冷启动后状态丢失。解决方案：
- 将游戏状态持久化到 Supabase 数据库
- 使用 Vercel 的 KV 或 Redis 存储
- 后端迁移到支持长连接的平台（如 Railway、Fly.io）

### Q: 实时通信不工作

确保 Supabase 项目的 Realtime 功能已启用（Dashboard → **Database** → **Realtime** → 开启相关表的 Realtime）。

---

## 替代部署方案

如果需要完整的长连接和游戏状态持久化，考虑以下平台部署后端：

| 平台 | 优势 | 适合 |
|------|------|------|
| **Railway** | 支持长运行进程、WebSocket | 生产级全栈部署 |
| **Fly.io** | 全球边缘部署、持久化进程 | 低延迟游戏服务 |
| **Render** | 免费层、自动部署 | 个人项目 |

在这种方案中，前端仍可部署在 Vercel，后端单独部署，修改前端的 API 地址指向后端服务即可。
