import type { AgentCard, Phase } from './types';

export function buildConversationPrompt(args: {
  profileJson: string;
  phase: Phase;
  startDate: string;
  endDate: string;
  sessionCount: number;
  bubblesPerSession: number;
  baseline: string;
  agent: AgentCard;
  priorTranscript?: string;
}) {
  const phaseRule = args.phase === 'historical'
    ? '你要从结构化记忆反向还原这些记忆最可能如何在真实聊天里逐渐出现。不能把字段直接改写成自我介绍，也不能让每条记忆都被说出。'
    : '你要继续模拟未来两周。延续已出现的生活线索，可有合理变化和新小事，但不得与人物稳定事实、权限和时间线冲突。';
  return `# 任务\n生成一组真实微信式的用户与长期 AI 守护者对话，用于 Memory Simulator。${phaseRule}\n\n# 用户完整设定（仅供模拟，不能整段复述）\n${args.profileJson}\n\n# 守护者人设\n姓名：${args.agent.name}\n说话感觉：${args.agent.voice}\n重视：${args.agent.values}\n原则：${args.agent.principle}\n小缺点：${args.agent.imperfection}\n兴趣：${args.agent.interests}\n它知道自己是 AI，不假装拥有人的身体、上班日程或现实经历。默认是朋友式陪伴，不发展强占有欲或自动恋爱。\n\n# 时间与活跃规则\n- 日期范围：${args.startDate} 至 ${args.endDate}\n- 用户基线：${args.baseline}\n- 本次是代表性采样：生成约 ${args.sessionCount} 个聊天时段，每段约 ${args.bubblesPerSession} 个消息气泡。日期分布要符合用户类别，不要机械平均。\n- 每段间隔可以是几小时或几天。每条消息给出相对本段开始的分钟数。\n\n# 对话硬规则\n- 像微信聊天，不写小说，不写旁白，不出现括号动作、舞台说明、心理分析、标签或 JSON 之外的解释。\n- 70% 消息 2–14 个中文字符，25% 为 15–28 字，极少数更长；单条最多约 50 字。\n- 一次通常发 1 条，偶尔连发 2 条，极少 3 条；不能每次固定三个气泡。\n- 不需要严格一问一答。允许忽略半个问题、突然换话题、打字式停顿、玩笑、吐槽、回访旧事。\n- 用户知道对方是 AI，不问“你最近忙不忙”这类把 AI 当真人的问题。\n- 用户不能过度配合信息收集；深层信息必须等信任、场景和表达欲都合适时才出现。\n- 守护者不做客服、心理咨询师或问卷；不模板化共情，不每句追问，不重复同义句，不替用户把话说满。\n- 命理术语最多偶尔出现，必须翻成日常语言；不能新编八字事实。\n- 对话须有具体上下文：如果说“作品发完”，此前或同句需自然说明是什么作品；每一段内部逻辑完整。\n- 任何敏感信息严格遵守 profile 中 privacy_and_permission；第三方信息不能写成用户本人事实。\n${args.priorTranscript ? `\n# 已有历史对话摘要（未来阶段只用于连续性）\n${args.priorTranscript}` : ''}\n\n# Memory 规则\n每个活跃日生成当日可沉淀的 memory_fragments。来源只可引用这次输出中真实出现过的 message ref。\n- explicit：用户明确说过；observed：行为或语言观察；inferred：推测，置信度不得高于 0.68。\n- current_state 不覆盖 stable_trait；新事实可 supersede 旧事实但要保留轨迹。\n- sensitive / third_party 默认不可用于社交匹配。无授权不是授权。\n- social_intent 只有用户真实表达认识人的意愿时才为 true，不能从孤独、问桃花或一时吐槽自动推断。\n\n# 输出\n只输出合法 JSON，不加 Markdown：\n{\n  "sessions": [{\n    "date": "YYYY-MM-DD",\n    "start_time": "HH:mm",\n    "topic": "具体且简短的本段主题",\n    "messages": [{"ref":"m1","speaker":"user|agent","text":"消息","offset_minutes":0}]\n  }],\n  "memory_fragments": [{\n    "date":"YYYY-MM-DD",\n    "domain":"pursuit|interest|lifestyle|experience|inner|personality|identity|wellbeing|relationship|social_intent",\n    "kind":"fact|preference|current_state|stable_trait|goal|relationship|permission|inference",\n    "content":"一条原子记忆",\n    "confidence":0.0,\n    "evidence_type":"explicit|observed|inferred",\n    "privacy":"normal|sensitive_personal|third_party_sensitive|explicit_private|inferred_sensitive",\n    "social_intent":false,\n    "source_refs":["m1"],\n    "status":"active|tentative|superseded"\n  }]\n}`;
}

