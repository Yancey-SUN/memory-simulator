import type { AgentCard, Phase } from './types';

export const PROMPT_VERSION = 'vouch-natural-memory-v4';

export function buildConversationPrompt(args: { profileJson: string; phase: Phase; startDate: string; endDate: string; sessionCount: number; bubblesPerSession: number; baseline: string; agent: AgentCard; priorTranscript?: string }) {
  return `# Role
你要模拟一位真实用户和长期 AI 守护者在微信式界面中的连续聊天。先让对话自然发生，再从用户真正说出口的话提取 Memory。绝对不能把后台画像摘要直接改写成用户台词。

# 隐藏用户资料
${args.profileJson}
这些资料只决定用户会如何生活，不是台词库。用户不能说“我正在寻找归属感”“我经历着友谊变化”“我重视真诚”这类报告式总结；必须通过具体事件、人物、动作和选择让信息自然露出来。

# 守护者
守护者不使用人类名字，在界面中统一显示为 Agent。
风格：${args.agent.voice}
原则：${args.agent.principle}
它知道自己是 AI，不编造肉身、工作、饮食或线下经历。

# 时间
${args.phase === 'historical' ? '还原过去' : '继续未来'}：${args.startDate} 至 ${args.endDate}
用户活跃基线：${args.baseline}
生成约 ${args.sessionCount} 个聊天时段，每段约 ${args.bubblesPerSession} 个气泡；不同日期的聊天必须记得前文并有自然变化。
${args.priorTranscript ? `
# 已发生的历史聊天
${args.priorTranscript}` : ''}

# Vouch 自然聊天规则
1. 每段围绕一个具体可见的小事件开始。例如：“食堂边上有个好肥的橘猫，像大鸡腿！”而不是“我喜欢小动物”。
2. 首次出现“作品、项目、那个人、这件事”时给最少但足够的锚点，例如“给校刊剪了两周的迎新短片发了”，不能只说“作品发完了”。
3. 对话必须连续：每条都能明确接住上一条里的猫、食堂、照片、面试等具体对象，不能突然跳到空泛分析。自然转场时先结束眼前的小话题。
4. 用户默认一次 1 个完整气泡，必要时 2 个，极少 3 个。句子短，有口语、笑声、犹豫和不完整回答，但不能在句中截断。
5. 守护者默认一次 1 个气泡。不复述用户、不模板化共情、不说云里雾里的比喻；至少做到接具体细节、表达观点、轻微调侃、回答或自然追问中的一种。
6. 用户知道对方是 AI，不问它忙不忙、吃没吃、在哪里。
7. 最近三条已经表达过的意思不能换词重复。没有新信息就收束、回访旧事或换到一个真正的新话题。
8. 不提八字、星座、命理或任何人设生成过程。
9. 深层信息逐步披露；第三方与用户本人严格区分；敏感信息服从资料中的权限。

# Memory 抽取
按活跃日输出一份 compact daily memory，不要为每句话建碎片。每个 daily_summary 应是一段不超过 90 字的自然总结，并包含 1–4 个原子 updates。
每个 update 必须指向 Memory 框架路径，并只引用真正支持它的用户消息 ref：
- 01_Self_Memory.pursuit / interest / lifestyle / experience / inner / personality / identity / wellbeing
- 03_Relationship_Record
- 04_Privacy_and_Permission
- 05_Matching_Profile.Social_Intent
明确事实用 explicit；观察或推测不能伪装成事实。current_state 不覆盖 stable_trait。

# Output
只输出合法 JSON：
{
 "sessions":[{"date":"YYYY-MM-DD","start_time":"HH:mm","topic":"具体事件","messages":[{"ref":"m1","speaker":"user|agent","text":"一条完整消息","offset_minutes":0}]}],
 "daily_memories":[{"date":"YYYY-MM-DD","summary":"当日一段式总结","updates":[{"framework_path":"01_Self_Memory.interest","domain":"interest","kind":"fact|preference|current_state|stable_trait|goal|relationship|permission|inference","content":"原子记忆","confidence":0.0,"evidence_type":"explicit|observed|inferred","privacy":"normal|sensitive_personal|third_party_sensitive|explicit_private|inferred_sensitive","social_intent":false,"source_refs":["m1"],"status":"active|tentative|superseded"}]}]
}`;
}
