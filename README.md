# Memory Simulator

[中文](#中文) · [English](#english)

线上体验 / Live demo: [vouch-memory-simulator.clean-crane-7316.chatgpt.site](https://vouch-memory-simulator.clean-crane-7316.chatgpt.site/)

---

## 中文

### 项目简介

Vouch Memory Simulator 是 Vouch Memory 策略的前序验证工具。它通过模拟用户与长期陪伴型 Agent 的持续对话，研究如何把原始、零散、带有时间变化的社交 Context，可靠地沉淀为可追溯的结构化 Memory。

项目关注的不是“让模型总结一段聊天”，而是验证完整的 Memory 形成过程：什么应该被记住、应该存在哪个字段、证据来自哪里、置信度多高、何时需要更新或遗忘，以及哪些内容不能用于匹配或对外展示。

### 核心流程

1. **读取模拟用户的原始 Memory**：包含基础资料、兴趣、关系、当前状态、社交意图及隐私边界等信息。
2. **还原历史对话**：按照用户类型和活跃度，推演过去一段时间内用户与 Agent 的聊天，并保留时间戳。
3. **模拟未来对话**：用户模型与 Agent 模型作为两个独立角色逐轮交互，继续模拟未来两周的生活流对话。
4. **按日抽取 Memory**：从当天原始消息中提取事实、状态、偏好、关系变化和 Social Intent。
5. **写入结构化字段**：每条 Memory 保留字段路径、来源消息、时间、置信度、证据类型和隐私级别。
6. **比较前后变化**：对照“原始 Memory”与“两周后的当前 Memory”，高亮新增或更新内容。
7. **回溯证据**：从 Memory 片段跳回产生它的原始对话，检查模型是否误读、过度推断或遗漏。

### 重点验证的问题

- 真人式聊天中的碎片信息如何落入稳定的 Memory Schema
- 短期状态与长期偏好如何区分
- 同一事实被重复提及时，应该增强置信度还是产生冗余
- 用户改变想法后，旧 Memory 如何更新、降权或失效
- 推测、第三方信息和敏感信息应如何标记
- Social Intent 是否有足够的原始对话证据
- Memory 是否能反过来帮助 Agent 延续话题、记住 Open Loop，并减少生硬追问
- 不同模型与 Prompt 对对话自然度、抽取准确度和字段覆盖率的影响

### 实验能力

- 创建、命名、修改、继续运行和删除实验
- 选择模拟用户、历史回溯天数、对话密度和并发数
- 编辑用户 Prompt、Agent Prompt 和人格规则 Markdown
- 将 Prompt 命名并保存到共享 Prompt 库，用于后续实验复用
- 对比不同 Prompt、模型和 API 厂商的生成质量
- 支持 DeepSeek、OpenAI、Qwen、Moonshot、SiliconFlow 及其他 OpenAI-compatible API
- 保存每次实验的模型、Prompt 和配置快照，保证结果可追溯
- 中断后保留已完成数据，并从失败位置继续运行

### 可检查与下载的产物

- 带时间戳的历史还原对话和未来两周对话
- 所有用户的原始 Chat History
- 每日 Memory 总结与结构化 Memory 文件
- Memory 字段路径、置信度、证据类型、隐私等级和来源消息
- 原始 Memory 与当前 Memory 的逐项比较
- 用户活跃度变化
- 实验配置、完成状态和失败原因

### 评估建议

对话质量与 Memory 质量应分开评估：

- **对话质量**：自然度、连续性、角色一致性、重复率、回复长度、是否保留继续聊下去的 Hook。
- **抽取质量**：事实准确率、字段归类、时间有效性、置信度校准、来源覆盖率和隐私合规。
- **长期价值**：Agent 是否能在后续对话中正确使用 Memory，并在用户纠正或状态变化后及时更新。

### 使用边界

- 这是 Memory 策略和实验架构的验证工具，不是生产用户数据库。
- 模拟对话用于发现问题和比较方案，不能替代真实用户数据与人工标注。
- 命理信息只能作为文化性或冷启动实验特征，不能被当作已确认的人格事实。
- “可记忆”不等于“可用于匹配”或“可向其他用户展示”。
- API Key 只应在当前页面内存或服务端环境变量中使用，不能写入实验记录或提交到 Git。

### 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

---

## English

### Overview

Vouch Memory Simulator is an upstream validation tool for Vouch's memory strategy. It simulates ongoing conversations between users and long-term companion agents to study how raw, fragmented, and time-sensitive social context can become reliable, traceable, structured memory.

The goal is not merely to summarize a transcript. The simulator evaluates the full memory lifecycle: what should be remembered, where it belongs in the schema, which messages support it, how confident the system should be, when it should be updated or forgotten, and whether it may be used for matching or external disclosure.

### Core Flow

1. **Load each synthetic user's source memory**, including profile, interests, relationships, current state, social intent, and privacy boundaries.
2. **Reconstruct historical conversations** according to the user's activity archetype, with timestamps.
3. **Simulate future conversations** for the following two weeks through genuine turn-by-turn interaction between separate user and agent roles.
4. **Extract memory daily** from the raw messages: facts, temporary states, preferences, relationship changes, and social intent.
5. **Write structured fields** with schema path, source messages, timestamp, confidence, evidence type, and privacy level.
6. **Compare before and after**, highlighting additions and updates between source memory and current memory after the simulation.
7. **Trace every claim back to evidence** to inspect misinterpretation, over-inference, duplication, and omission.

### Key Questions

- How should fragmented conversational evidence map into a stable memory schema?
- How can temporary states be separated from durable preferences?
- Should repeated evidence increase confidence or create redundant records?
- How should older memory be updated, weakened, or invalidated when a user changes their mind?
- How should inferred, third-party, and sensitive information be marked?
- Does a social-intent judgment have sufficient transcript evidence?
- Can memory help the agent continue topics, remember open loops, and avoid interview-like questioning?
- How do models and prompts affect conversational naturalness, extraction accuracy, and schema coverage?

### Experiment Features

- Create, rename, edit, resume, and delete experiments
- Select users, historical range, conversation density, and concurrency
- Edit the user prompt, agent prompt, and guardian-personality Markdown
- Name and save reusable prompt versions in a shared prompt library
- Compare conversation and extraction quality across prompts, models, and providers
- Support DeepSeek, OpenAI, Qwen, Moonshot, SiliconFlow, and other OpenAI-compatible APIs
- Preserve a snapshot of model, prompt, and configuration for every run
- Keep completed sessions after interruption and resume from the failed position

### Inspectable and Downloadable Outputs

- Timestamped reconstructed history and two-week future conversations
- Raw chat history for all users
- Daily memory summaries and structured memory files
- Schema path, confidence, evidence type, privacy level, and source messages
- Side-by-side source-memory and current-memory comparison
- User-activity changes
- Experiment configuration, completion state, and failure reasons

### Evaluation Guidance

Conversation quality and memory quality should be evaluated separately:

- **Conversation quality:** naturalness, continuity, role consistency, repetition, response length, and useful conversational hooks.
- **Extraction quality:** factual accuracy, schema placement, temporal validity, confidence calibration, source coverage, and privacy compliance.
- **Long-term value:** whether the agent uses memory correctly in later conversations and updates it after corrections or changing circumstances.

### Scope and Limitations

- This is a validation environment for memory strategy and experiment architecture, not a production user database.
- Synthetic conversations help expose failure modes and compare approaches; they do not replace real-user data or human annotation.
- BaZi or other metaphysical signals may only be used as cultural or cold-start experiment features, never as confirmed personality facts.
- Being memorable does not automatically make information eligible for matching or disclosure.
- API keys should exist only in current-page memory or server-side environment variables and must never be stored in experiment records or committed to Git.

### Local Development

Node.js `>=22.13.0` is required.

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```
