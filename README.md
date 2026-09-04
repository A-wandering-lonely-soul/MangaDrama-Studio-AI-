# MangaDrama-Studio-AI-
本项目是一个面向 AI 生成式内容创作的可视化工作台，聚焦于短视频、漫剧式场景创作与自动化编排。系统支持在浏览器端完成素材导入、角色摆放、镜头设计、字幕生成、动画预览以及视频导出，覆盖从脚本构思到成片输出的完整流程。前端基于 React + TypeScript + Vite 构建，界面可视化程度高，便于快速进行内容编辑与效果演示；后端基于 NestJS 提供任务调度、AI 接口封装和状态管理能力，支持本地 Mock 与阿里云百炼等真实模型接入，具备从本地联调到真实生产环境扩展的能力。项目同时预留了 Tauri 桌面端入口与本地素材目录管理方案，目标是打造一个轻量、可扩展的 AI 视频创作平台。

# 使用文档（本地联调）

## 先回答你的问题

当前版本后端支持双通道：`mock` 和 `aliyun`。

- `AI_PROVIDER=mock`：本地 Mock，不请求云端。
- `AI_PROVIDER=aliyun`：走阿里云百炼（DashScope）接口。

即使不填阿里云 Key，也可以先用 Mock 完整跑通流程；需要真实大模型效果时再切换到 aliyun。

后端实现位置：`server/src/modules/ai/ai.service.ts`

## 环境要求

- Node.js 20+（当前项目在 Node 22 已验证）
- pnpm 9+
- Windows PowerShell 或 CMD

可选：
- Rust + Cargo（仅桌面端 Tauri 原生打包需要，Web + Server 联调不需要）

## 第一次启动（推荐）

在项目根目录执行：

```bash
pnpm install
```

创建后端环境变量文件：

```powershell
Copy-Item server/.env.example server/.env
```

## 启动服务（最短路径）

在项目根目录执行：

```bash
pnpm dev:core
```

说明：`dev:core` 与 `dev:server` 现在会在启动前自动清理 3300 端口上的残留进程，减少 `EADDRINUSE` 冲突。

启动后默认地址：

- Web 编辑器：http://localhost:5173
- AI Server：http://localhost:3300

## 5 分钟上手（创建台怎么用）

如果你只想先看到一个“半完成品”，不用理解全部按钮，直接按这个最短流程：

1. 启动前后端后打开页面
2. 点击 `一键加载半成品示例`，再点 `播放`
4. 你会看到：
- 中心画布出现背景和角色
- 镜头有推进变化
- 底部有字幕切换

说明：该半成品示例已使用内置图片数据，不依赖本地 `static` 目录；即使你没有放任何图片，也能看见图像。
说明：中间预览区已固定在可视区，左右面板滚动不会改变预览区位置。

如果要回到空白编辑台，可在项目管理点击 `恢复初始状态`。

看完后再按下面完整流程继续编辑。

按页面从左到右，建议第一次这样操作：

1. 新建一个可识别的项目名

- 左侧 `项目管理` -> `项目名称` 输入框改成你自己的名字，例如：`测试短片-01`
- 点击 `立即保存`

2. 先放一个角色到画布

- 左侧 `素材操作` 点击 `添加演示角色`
- 中间画布会出现角色；右侧 `对象列表` 也会新增对象

3. 再导入你自己的图和音频

- 点击 `上传图片素材` 选择图片
- 点击 `上传音频素材` 选择音频
- 在左侧 `素材列表` 里，对图片点 `加入场景`，对音频点 `加入音轨`

4. 让 AI 生成内容（当前是 Mock）

- 在 `故事输入` 写一句剧情，点 `生成剧本`
- 再点 `生成分镜`
- 点 `分镜一键编排场景`，会把分镜转成当前场景
- 需要测试图片任务时点 `生成图片素材`，等待 `任务状态` 变 `SUCCEEDED`

5. 编辑对象位置和层级

- 在右侧 `对象列表` 点击对象进行选中
- 右侧 `变换编辑` 修改 X/Y/宽高/缩放/旋转
- 左侧用 `置于顶层/底层/上移一层/下移一层` 调整遮挡关系

6. 做一个最小动画预览

- 先选中一个对象，点 `为选中对象添加位移动画`
- 点 `添加镜头推进动画`
- 点 `生成演示字幕`
- 用 `播放/暂停/停止` 预览

7. 保存与导出视频

- 点 `立即保存`
- 点 `导出 MP4 视频`
- 等待播放走完场景时长后自动下载 `.mp4` 文件

## 3 分钟做出一个视频（最简单）

1. 点 `一键加载半成品示例`。
2. 点 `播放` 看一遍效果。
3. 点 `导出 MP4 视频`，等待完成自动下载。

如果想自己做一版：

1. `添加演示角色` 或从 `静态图片预览` 里 `加入场景`。
2. 点 `为选中对象添加位移动画`。
3. 点 `添加镜头动画`。
4. 点 `生成演示字幕`（可选）。
5. 点 `导出 MP4 视频`。

## 接入 AI 前后有什么区别

接入前（mock）：

- 出图与文案是模板化模拟，稳定但变化少。
- 速度快，适合调 UI 和流程。
- 不受云端额度影响。

接入后（aliyun）：

- 剧本、分镜、图片更有变化和生成感。
- 速度相对慢一些，受网络与模型负载影响。
- 受账号额度/模型权限影响，可能出现 401/403/429。

你可以在页面直接看当前状态：

- 顶部：`Provider: mock/aliyun`
- 右侧属性面板：`Provider 状态`（模型名、Key状态）

## 用本地素材目录（static/image + static/music）

如果你想使用固定目录管理素材，按下面做：

1. 把图片放到目录 `static/image`（或 `server/static/image`）

- 支持：png / jpg / jpeg / webp / gif / svg

2. 把音乐或歌词放到目录 `static/music`（或 `server/static/music`）

- 音乐支持：mp3 / wav / ogg / m4a / flac
- 歌词支持：lrc（可导入到字幕轨）
- ncm：可识别并展示，但浏览器端暂不直接播放，需先转 mp3

3. 重启后端（让静态目录服务生效）

```bash
pnpm dev:server
```

4. 打开页面左侧素材区：

- `静态图片预览（static/image）`：点 `加入场景`
- `静态音乐与歌词（static/music）`：
	- `audio` 文件点 `加入音轨`
	- `lrc` 文件点 `导入歌词到字幕`
	- `ncm` 文件点 `提示转码`

5. 在右侧 `对象列表` 选中它，再用 `变换编辑` 调位置和大小

如果没看到缩略图：

- 先确认后端在运行
- 刷新浏览器页面
- 检查文件确实在 `static/image` 或 `static/music`

## 素材替换/删除说明

- 在左侧 `素材列表` 每条素材都有 `替换` 和 `删除`
- 删除素材会自动清理它在场景对象、音轨、动画轨道里的关联引用
- 如果只是换图不想改对象位置，优先用 `替换`

## 验证后端是否正常

保持后端运行状态下，在项目根目录执行：

```bash
pnpm smoke:ai
```

预期看到：

- story title 输出
- storyboard scenes 数量输出
- image task 状态从 PENDING/RUNNING 到 SUCCEEDED

## 分开启动（便于排错）

终端 1（后端）：

```bash
pnpm dev:server
```

说明：该命令已内置端口清理（3300），一般不需要再手动杀进程。

终端 2（前端）：

```bash
pnpm dev:web
```

## 常见问题

1. 没有阿里云 Key 为什么也能测？

因为现在走的是 Mock AI，不是线上模型调用。目的是先把编辑器、任务流、存储流打通。

2. `pnpm smoke:ai` 报连接失败

请先确认后端已启动（`pnpm dev:server` 或 `pnpm dev:core`），并且 `http://localhost:3300` 未被占用。

3. 后端报错 `EADDRINUSE: address already in use :::3300`

说明 3300 端口已经被其他进程占用，通常是你之前开的 Node 服务还在。

先查占用：

```powershell
Get-NetTCPConnection -LocalPort 3300 -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
```

再结束进程（把 PID 换成上一步查到的数字）：

```powershell
Stop-Process -Id PID -Force
```

然后重新启动后端：

```bash
pnpm dev:server
```

4. CORS 报错

检查 `server/.env` 中 `CORS_ORIGIN` 是否包含当前前端地址（如 `http://localhost:5173`）。

5. 桌面端跑不起来

Tauri 需要 Rust/Cargo；如果你只测试前后端联调，可先不跑桌面端。

## 接入阿里云 API（免费优先）

你现在这个项目默认走 Mock。要接阿里云，先从百炼（DashScope）开始，通常有新用户免费额度或试用额度；具体剩余额度以控制台当日显示为准。

### 我到底该去哪里开通

直接打开下面两个入口：

- 阿里云控制台首页：https://home.console.aliyun.com/
- 百炼控制台（DashScope）：https://bailian.console.aliyun.com/

进入后按这个路径点：

1. 先登录阿里云账号（未实名先做实名认证）。
2. 打开百炼控制台后，在左侧找到“API-KEY 管理”或“密钥管理”。
3. 点击“创建 API Key”。
4. 复制新生成的 Key（只显示一次时一定先保存好）。

如果你在百炼控制台没看到入口：

1. 先在阿里云首页搜索“百炼”或“DashScope”。
2. 进入服务页后点击“立即开通”。
3. 再回到百炼控制台创建 Key。

### 第一步：开通与拿 Key

1. 注册并登录阿里云账号，完成实名认证。
2. 进入百炼控制台（DashScope / Model Studio）。
3. 开通服务并创建 API Key。
4. 在模型页查看“免费试用/免费额度”标签，优先选择低成本模型：
- 文本生成优先：`qwen-plus`（通用质量较稳）
- 成本更低可试：`qwen-turbo`（若控制台有可用额度）
- 文生图可先用：`wanx2.1-t2i-turbo`（以控制台可用模型为准）

建议：先只开文本模型，跑通剧本/分镜；图片模型第二步再开，方便控成本。

### 第二步：把密钥填进项目

密钥放在后端环境变量文件：

- 文件位置：`server/.env`
- 模板来源：`server/.env.example`

如果还没有 `server/.env`，先执行：

```powershell
Copy-Item server/.env.example server/.env
```

然后编辑 `server/.env`：

```env
AI_PROVIDER=aliyun
DASHSCOPE_API_KEY=你的百炼APIKey
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_TEXT_MODEL=qwen-plus
DASHSCOPE_IMAGE_MODEL=wanx2.1-t2i-turbo
```

说明：

- `AI_PROVIDER=mock` 表示继续走本地 Mock。
- `AI_PROVIDER=aliyun` 才会切到阿里云（下一步对接 Provider 代码后生效）。

### 第三步：在当前项目里应用

当前仓库已经加好了配置位，但 AI 业务逻辑仍是 Mock 实现。

- 配置文件：`server/src/config/app.config.ts`
- 业务实现：`server/src/modules/ai/ai.service.ts`

你下一步只需要把 `ai.service.ts` 里的 `createStory/createStoryboard/createImageTask` 改为：

1. 当 `AI_PROVIDER=mock` 时走现有逻辑。
2. 当 `AI_PROVIDER=aliyun` 时调用 DashScope API。

这样本地开发和线上调用可以一键切换。

### 第四步：启动与验证

```bash
pnpm dev:server
pnpm smoke:ai
```

如果返回 401 或 403：

- 检查 Key 是否有前后空格
- 检查百炼服务是否已开通
- 检查当前模型是否在你账号的可用范围

### 如何确认现在走的是哪条通道

1. 页面顶部会显示 `Provider: mock` 或 `Provider: aliyun`。
2. 右侧属性面板有“Provider 状态”，可看到模型名和 Key 状态。
3. 直接查接口：`GET http://localhost:3300/api/ai/provider-status`

判定差异：

- `mock`：响应更快且输出风格固定（演示模板感明显）。
- `aliyun`：响应延时更高但内容变化更丰富，且会受模型名与额度影响。
