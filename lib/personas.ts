import dataset from '@/data/campus-users.json';
import type { AgentCard, PersonaSummary } from './types';
import { buildGuardianCard, guardianPromptProfile } from './guardian-personality';

type AnyObject = Record<string, any>;
const users = dataset.users as Record<string, AnyObject>;

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
      agent: buildGuardianCard(user),
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
    confirmed_bazi: user.profile_tags?.day_master,
    guardian: guardianPromptProfile(buildGuardianCard(user)),
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
