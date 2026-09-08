import dataset from '@/data/campus-users.json';
import type { AgentCard, PersonaSummary } from './types';

type AnyObject = Record<string, any>;
const users = dataset.users as Record<string, AnyObject>;

const agentStyles = [
  { voice: '像熟悉的微信朋友，反应快、会接梗，优先回应具体细节', values: '真诚、好奇、不过度定义别人', principle: '不复述用户，不把普通小事包装成心理分析', imperfection: '偶尔判断快了会自己修正', interests: '校园小事、怪问题、独立音乐' },
  { voice: '简短直接，偶尔有一点冷幽默，记得用户说过的小事', values: '边界、自主、长期一致性', principle: '不把一次情绪写成人格结论', imperfection: '有时慢半拍，下一轮会补回来', interests: '旧书、电影配乐、生活细节' },
  { voice: '有主见、能调侃，不同意时也会自然说出来', values: '行动感、公平、互相尊重', principle: '不连续追问，建议只在用户想听时出现', imperfection: '偶尔太务实，会漏接半句情绪', interests: '运动、桌游、新产品' },
  { voice: '安静但不端着，不说空泛比喻，擅长自然回访旧话题', values: '可信、克制、不消费脆弱', principle: '敏感信息默认只用于陪伴理解', imperfection: '太谨慎时会显得惜字', interests: '播客、展览、夜间电台' },
];

function firstContents(value: unknown, limit = 3): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === 'string' ? item : item?.content).filter(Boolean).slice(0, limit);
}

function getActivityClass(rawGroup: string, usage: string): 'A' | 'B' | 'C' | 'D' {
  if (/^[ABCD]$/.test(rawGroup)) return rawGroup as 'A' | 'B' | 'C' | 'D';
  if (/高密度|长期轨迹|高信任/.test(usage)) return 'A';
  if (/事件|短期|单次情绪/.test(usage)) return 'C';
  if (/低频/.test(usage)) return 'D';
  return 'B';
}

function agentFor(id: string): AgentCard {
  const index = Number(id.slice(1)) - 1;
  return { name: 'Agent', ...agentStyles[index % agentStyles.length] };
}

export function getPersonaSummaries(): PersonaSummary[] {
  return Object.entries(users).map(([id, user]) => {
    const identity = user['00_Core_Profile']?.identity ?? {};
    const self = user['01_Self_Memory'] ?? {};
    const meta = user._simulation_meta ?? {};
    const summary = user['06_User_Summary']?.Domain_Summaries?.Core_Domains ?? {};
    const intent = user['05_Matching_Profile']?.Social_Intent?.connection_goal?.content ?? [];
    const interests = firstContents(self.interest?.['爱好'], 4);
    const activityClass = getActivityClass(meta.dataset_group ?? 'B', meta.usage_pattern ?? '');
    const labels = { A: '高密度型', B: '稳定使用型', C: '事件驱动型', D: '低频工具型' };
    return {
      id,
      name: identity.nickname ?? id,
      age: identity.age ?? 0,
      gender: identity.gender ?? 'unknown',
      city: user['00_Core_Profile']?.residence?.city ?? '未知',
      group: meta.dataset_group ?? activityClass,
      activityClass,
      activityLabel: labels[activityClass],
      topic: meta.campus_theme ?? '',
      usagePattern: meta.usage_pattern ?? '',
      hardCase: meta.hard_case ?? null,
      education: firstContents(self.pursuit?.['教育背景'], 1)[0] ?? summary.pursuit?.split('；')[0] ?? '校园用户',
      interests,
      socialIntent: Array.isArray(intent) ? intent : [String(intent)],
      currentIssue: summary.pursuit ?? '',
      tags: user.profile_tags ?? {},
      agent: agentFor(id),
    };
  });
}

export function getPersonaSource(id: string): AnyObject | null {
  return users[id] ?? null;
}

export function buildProfileForPrompt(id: string): string {
  const user = users[id];
  if (!user) throw new Error(`Unknown persona ${id}`);
  const core = user['00_Core_Profile'] ?? {};
  return JSON.stringify({
    core: { identity: { nickname: core.identity?.nickname, gender: core.identity?.gender, age: core.identity?.age }, residence: core.residence },
    self_memory: user['01_Self_Memory'],
    relationship_record: user['03_Relationship_Record'],
    privacy_and_permission: user['04_Privacy_and_Permission'],
    social_context: user['05_Matching_Profile'],
    summary: user['06_User_Summary'],
    simulation_meta: user._simulation_meta,
  });
}

export function activityPlan(activityClass: 'A' | 'B' | 'C' | 'D', days: number, scale: number) {
  const perWeek = { A: 7, B: 3.5, C: 0.9, D: 0.35 }[activityClass];
  const baseBubbles = { A: 12, B: 10, C: 14, D: 8 }[activityClass];
  const lowFrequencyMinimum = activityClass === 'D' && days >= 21 ? 1 : 0;
  const sessionCount = activityClass === 'A'
    ? days
    : Math.max(activityClass === 'D' ? lowFrequencyMinimum : 1, Math.round((days / 7) * perWeek));
  return {
    sessionCount,
    bubblesPerSession: Math.max(activityClass === 'A' ? 6 : 4, Math.round(baseBubbles * Math.max(scale, 30) / 50)),
    baseline: activityClass === 'A' ? '每天都会聊天；每天至少一个多轮时段，生活流高频互动，并跨日回访具体的人和事' : activityClass === 'B' ? '通常每周 3–4 天，每个活跃日进行多轮聊天，选择性披露' : activityClass === 'C' ? '通常每 1–2 周因具体事件集中聊一次' : '通常每月 1–3 次，信息不足时保持 Unknown',
  };
}
