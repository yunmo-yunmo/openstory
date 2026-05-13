# OpenStory — AI 小说协作工具设计文档

**日期:** 2026-05-08
**状态:** 设计完成，待用户审阅

---

## 1. 产品定位

OpenStory 是一个**以 AI 为核心智能引擎的小说创作工具**。AI 的角色定位：
- **主力模式（A）：** AI 是作者身旁的助手——提供建议、检查一致性、辅助上下文管理、推荐灵感。作者驱动，AI 支持。
- **辅助模式（B）：** AI 在需要时可以作为更主动的合作者——续写段落、改写内容、参与情节讨论。

目标用户是**任何类型的个人小说作者**，工作流覆盖**构思 → 大纲 → 写作 → 编辑打磨**的全过程，核心聚焦在**写作阶段**。

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router, React 19) |
| API | tRPC v11 + superjson |
| 数据库 | SQLite via Prisma ORM |
| 认证 | NextAuth.js v5 (Discord provider) |
| AI | Vercel AI SDK v6 + 多 Provider（@ai-sdk/anthropic, @ai-sdk/openai, ...） |
| 编辑器 | TipTap (React) — 富文本所见即所得 |
| 样式 | Tailwind CSS v4 |
| 校验 | Zod + @t3-oss/env-nextjs |

---

## 3. 系统架构（七层）

```
UI 层          — 双栏布局（文件树 + 编辑器 + AI 对话面板）
AI 会话层      — Session Engine、上下文管理器、流式输出
LLM Provider   — Provider 抽象、API Key 管理、模型路由、速率限制、回退策略
AI 工具层      — 8 个 AI 工具（读写/搜索/检查/规划）
API 层         — tRPC 路由（project/chapter/character/session/search）
数据层         — Prisma + SQLite（Project/Chapter/Character/WorldNote/Outline/AISession/Snapshot）
后台 Agent     — 异步一致性审查、自动摘要生成
```

核心原则：
- AI 通过工具层间接访问数据，不直接操作数据库
- AI 会话绑定到章节，但可跨章访问整部小说
- 后台 Agent 异步运行，不阻塞写作流程
- LLM Provider 抽象层隔离模型细节，会话层不直接绑定任何特定模型供应商

---

## 4. 数据模型

### 核心表结构

| 表 | 关键字段 | 说明 |
|----|----------|------|
| **Project** | id, title, description, genre, userId | 小说项目 |
| **Chapter** | id, projectId, title, content(TipTap JSON), order, wordCount, **summary**, summaryUpdatedAt, status | 章节。summary 由 AI 自动生成 |
| **Character** | id, projectId, name, description, traits, relationships(JSON), notes | 角色档案 |
| **WorldNote** | id, projectId, title, content(JSON), category, tags, order | 世界观/设定 |
| **Outline** | id, projectId, chapterId?, title, description, order, parentId, status | 大纲（支持嵌套） |
| **AISession** | id, projectId, chapterId?, title, messages(JSON), toolState(JSON) | AI 会话历史 |
| **ChapterSnapshot** | id, chapterId, content, wordCount, summary?, version | 章节版本快照 |
| **LLMConfig** | id, userId, provider, apiKey(加密), model, isActive | 用户的 LLM Provider 配置 |

### 关键设计
- Chapter.content 存 TipTap JSON（非 Markdown），导入/导出需转换层
- Chapter.summary 由 AI 在章节保存后自动生成，用于上下文管理的轻量级查询
- ChapterSnapshot 保留历史版本，支持回溯，不做复杂 diff
- Outline 支持 parentId 嵌套（卷 → 章 → 节）
- SQLite 足够——单机创作工具不需要 PostgreSQL

---

## 5. LLM Provider 模块

### 5.1 设计目标

AI 会话层不直接调用任何特定 LLM SDK，而是通过 Provider 抽象层交互。这样可以：
- 自由切换和组合不同模型供应商
- 不同任务路由到不同模型（成本/质量优化）
- 用户自带 API Key，或使用服务端默认配置

### 5.2 Provider 抽象层

基于 Vercel AI SDK 的多 Provider 支持构建统一接口：

```typescript
interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<string>
  streamChat(messages: Message[], options?: ChatOptions): AsyncIterable<string>
  embedding(text: string): Promise<number[]>
}

interface ChatOptions {
  model?: string          // 覆盖默认模型
  maxTokens?: number
  temperature?: number
  tools?: ToolDefinition[]
}
```

初始支持的 Provider：
- **Anthropic** — `@ai-sdk/anthropic`（Claude 系列）
- **OpenAI** — `@ai-sdk/openai`（GPT 系列）

扩展方式：新增 Provider 只需实现 `LLMProvider` 接口并注册，无需改动会话层代码。后续可接入 DeepSeek、本地 Ollama 等。

### 5.3 API Key 管理

| 来源 | 优先级 | 存储位置 |
|------|--------|----------|
| 用户自定义 Key | 最高 | 加密存入数据库（UserSettings 表） |
| 环境变量 | 中 | `.env`（服务端部署时配置） |
| 服务默认 | 最低 | 不存储，仅兜底 |

用户可在设置页面配置每个 Provider 的 API Key，支持多 Provider 同时配置。

### 5.4 模型路由

不同任务类型可路由到不同模型，实现成本与质量的平衡：

| 任务 | 推荐模型层级 | 说明 |
|------|-------------|------|
| 聊天/讨论 | 主模型（Claude Sonnet / GPT-4o） | 核心交互，需要理解力 |
| 写作/续写 | 高质量模型（Claude Opus / GPT-4o） | 需要高质量文学输出 |
| 摘要生成 | 轻量模型（Claude Haiku / GPT-4o-mini） | 量大、高频、任务简单 |
| 一致性检查 | 主模型（Claude Sonnet / GPT-4o） | 需要仔细对比 |
| 外部搜索分析 | 中等模型（Claude Sonnet / GPT-4o-mini） | 信息提取和处理 |

支持 per-project 和全局两种模型配置粒度。

### 5.5 速率限制与回退

- 内置速率限制（RPM/TPM），超出时请求排队等待
- 主 Provider 不可用时自动回退到备用 Provider
- 回退链示例：Anthropic → OpenAI → 用户自定义 Provider
- 回退触发条件：5xx 错误、超时（30s）、429 速率限制
- 回退失败后返回友好错误提示，不静默丢弃

### 5.6 数据模型补充

新增 **LLMConfig** 表：

| 表 | 关键字段 | 说明 |
|----|----------|------|
| **LLMConfig** | id, userId, provider, apiKey(加密), model, isActive | 用户的 LLM 配置 |

---

## 6. AI 会话系统（核心）

### 6.1 会话模型

作者打开第N章 → 启动/继续 AI 会话 → AI 自动加载上下文 → 用户发指令 → AI 推理 → 调用工具 → 返回结果 → 循环。

每个会话绑定到一个章节，但 AI 可以通过工具跨章访问整部小说的任何内容。

### 6.2 上下文管理（四级策略）

| 层级 | 名称 | 内容 | 加载时机 |
|------|------|------|----------|
| **L0** | 始终在线 | 当前章节全文 + 大纲全貌 + 角色列表 | 会话开始时 |
| **L1** | 摘要层 | 前3章、后1章的摘要 + 相关角色摘要 | L0 后自动补充 |
| **L2** | 按需提取 | 通过 `read_chapters` 工具加载任意章节全文 | AI 判断需要时 |
| **L3** | 搜索提取 | 通过 `search_mentions` 搜索角色/物品/伏笔跨章出现 | 一致性检查时 |

### 6.3 AI 工具清单

| 工具 | 功能 |
|------|------|
| `read_chapters` | 读取指定章节全文（支持多个章节 ID） |
| `read_characters` | 读取角色详情（描述/特征/关系） |
| `write_section` | 在指定位置生成/插入/替换文本块 |
| `update_outline` | 创建/修改大纲条目 |
| `search_mentions` | 全文搜索角色/物品/关键词的跨章出现 |
| `check_consistency` | 检查当前章与前文的逻辑/时间线/角色矛盾 |
| `generate_summary` | 为指定章节生成/更新 AI 摘要 |
| `web_search` | 搜索外部参考资料（历史/科学/写作技巧） |

### 6.4 工具调用循环

用户消息 → AI 推理 → 决定是否需工具：
- 不需要 → 直接回复
- 需要 → 调用工具 → 结果返回 → 继续推理 → 最多 5 轮

### 6.5 并发

AI 操作**实际并发执行**，上限 **4 个**。超过上限时提示用户等待。每条指令独立显示进度和结果。

### 6.6 后台 Agent

每章保存后自动触发：
1. `generate_summary` — 更新本章摘要
2. `check_consistency` — 与前文对照检查矛盾
3. 发现问题 → 推送通知到 AI 对话面板

---

## 7. UI 布局

### 7.1 主写作界面（三栏）

```
┌──────────┬──────────────────────┬───────────┐
│ 文件树    │   TipTap 富文本编辑器  │ AI 对话面板 │
│          │                      │           │
│ 📖 项目名 │  章节正文内容          │ 对话历史    │
│ ▸ 大纲    │  富文本格式            │ AI 建议     │
│ 📄 章节1  │  光标位置              │ 采纳/拒绝   │
│ 📄 章节2  │                      │ 输入框     │
│ 👤 角色   │                      │           │
│ 🌍 设定   │                      │           │
└──────────┴──────────────────────┴───────────┘
```

### 7.2 内联指令

在编辑器中输入 `/` 弹出指令菜单：
- `/续写` — 从光标位置续写
- `/改写` — 改写选中文本
- `/扩写` — 扩展选中段落
- `/缩写` — 精简选中段落
- `/检查` — 检查前后一致性
- `/建议` — 给出改进建议

选中文本后出现浮动工具栏，快捷触发 AI 操作。

### 7.3 交互状态

- **AI 生成中：** 编辑器显示流式光标，逐字输出。对话面板同步显示
- **采纳建议：** 文本正式写入章节，自动保存，触发后台摘要更新
- **一致性警告：** 面板顶部黄色警告条，点击查看详情
- **AI 使用工具：** 对话面板显示 "正在读取第2章摘要..." 等状态

---

## 8. TXT 导入/导出

### 8.1 导入流程

```
上传 TXT → 检测编码 → 智能拆分章节 → 预览确认 → 创建项目
```

- 支持 `.txt` / `.md`，自动检测 UTF-8 / GBK / GB2312 编码
- 拆分规则（优先级递减）：
  1. 正则匹配 "第X章"、"Chapter X"、"CHAPTER X"、"第X卷"
  2. 分隔线：连续 `===` / `***` / `---`
  3. 5+ 连续空行（兜底）
- 预览确认界面：章节标题 + 前50字，允许手动调整/合并/重命名
- 导入后逐章调用 AI 生成摘要

### 8.2 导出

- 单文件 TXT — 所有章节合并，自动添加章节标题分隔
- 分章 TXT — 每章一个文件，ZIP 打包下载
- 选项：仅正文 / 含 AI 批注痕迹
- TipTap JSON → 纯文本：保留段落结构和粗体/斜体（转 Markdown），移除富文本样式

---

## 9. 异常处理

| 场景 | 策略 |
|------|------|
| AI 调用失败 | 友好提示 + 自动重试一次。工具调用失败不中断会话 |
| 导入拆分失败 | 整个文件作为单章，允许手动切割；编码失败提示手动选择 |
| 上下文窗口溢出 | L0+L1 摘要把关，只加载最近 N 章摘要，其余按需查询 |
| 章节过长 | 分段加载，AI 通过工具分页读取；编辑器虚拟滚动 |
| 自动保存冲突 | 防抖 + 乐观锁，最后写入者胜出但保留快照 |
| 并发 AI 超限 | 上限 4 个，超限提示等待 |
| LLM Provider 不可用 | 按回退链自动切换（Anthropic→OpenAI→自定义），全部不可用时提示用户检查配置 |

---

## 10. 测试策略

| 类型 | 范围 |
|------|------|
| 单元测试 | 章节拆分逻辑、TipTap↔纯文本转换、摘要提取优先级算法 |
| 集成测试 | tRPC API 端点、AI 工具调用链路、导入/导出完整流程 |
| E2E | 核心写作流程：创建项目 → 写章节 → AI 对话 → 采纳建议 → 导出 |
| 暂不做 | AI 输出质量测试（依赖模型，非代码逻辑） |

---

## 11. 版本管理

自动保存 + 简单撤销（Ctrl+Z），不做复杂的 Git 式版本管理。通过 ChapterSnapshot 表保留历史快照，支持"回看旧版"。

---

## 12. 认证

NextAuth.js v5 + Discord 登录。单人创作工具，Discord 登录即可满足身份认证需求。
