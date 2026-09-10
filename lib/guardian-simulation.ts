import { GUARDIAN_AGENT_PROMPT, GUARDIAN_MVP_SPEC, GUARDIAN_PROMPT_TEMPLATE, GUARDIAN_USER_PROMPT } from './prompts';
import { getPersonaSummaries, getPersonaSource } from './personas';
import { everydayMoments, guardianScenes } from './guardian-scenes';
import type { ChatMessage, MemoryFragment, Phase, RunRecord } from './types';

export const GUARDIAN_RUN_ID = 'guardian-human-v1';
const anchor = '2026-09-10';

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return Math.abs(value >>> 0);
}

function dateAt(offset: number) {
  const date = new Date(`${anchor}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function momentOffsets(activityClass: string, phase: Phase) {
  const historical: Record<string, number[]> = { A: Array.from({ length: 28 }, (_, index) => index - 28), B: Array.from({ length: 14 }, (_, index) => index * 2 - 28), C: [-22, -7], D: [-16] };
  const future: Record<string, number[]> = { A: Array.from({ length: 14 }, (_, index) => index), B: [0, 2, 4, 6, 8, 10, 12], C: [6], D: [] };
  return (phase === 'historical' ? historical : future)[activityClass] ?? [];
}

function frameworkFor(domain: string) {
  if (domain === 'relationship') return '03_Relationship_Record';
  if (domain === 'permission') return '04_Privacy_and_Permission';
  if (domain === 'social_intent') return '05_Matching_Profile.Social_Intent';
  return `01_Self_Memory.${domain}`;
}

function tuneMomentLine(line: string, archetype: string, key: string) {
  const variant = hash(key) % 4;
  if (archetype === '稳燃共振型' && variant === 0 && !/[？?]$/.test(line) && !/[哈啊]/.test(line)) return `${line.replace(/[。！!]$/, '')}哈哈`;
  if (archetype === '柔锋型') return line.replace(/^很好，/, '').replace(/。$/, '');
  if (archetype === '定流型' && variant === 1) return line.replace(/^那/, '嗯，那');
  if (archetype === '同行生长型' && variant === 2 && /先/.test(line)) return line.replace('先', '那就先');
  return line;
}

function tuneUserLine(line: string, personaId: string, messageIndex: number, key: string) {
  const variant = hash(`${personaId}-${key}`) % 6;
  if (variant === 0) return line.replace('我刚', '我刚刚').replace('今天', '今天居然');
  if (variant === 1) return line.replace('宿舍', '寝室').replace('食堂', '二食堂').replace('图书馆', '图书馆二楼');
  if (variant === 2) return line.replace('结果', '然后').replace('现在我', '我现在').replace('特别', '巨');
  if (variant === 3 && messageIndex === 0) return `救命，${line}`;
  if (variant === 4) return line.replace('老师', '任课老师').replace('刚才', '刚刚').replace('有点', '有一点');
  return line.replace(/[。！!]$/, '');
}

export function buildGuardianOptimizedRun(personaFilter?: string) {
  const profiles = getPersonaSummaries();
  const selectedIds = profiles.map((profile) => profile.id);
  const messages: ChatMessage[] = [];
  const memories: MemoryFragment[] = [];
  let sequence = 0;

  for (const profile of profiles) {
    if (personaFilter && profile.id !== personaFilter) continue;
    const curated = guardianScenes[profile.id];
    if (!curated) continue;
    const idNumber = Number(profile.id.slice(1));
    for (const phase of ['historical', 'future'] as Phase[]) {
      const scene = curated[phase];
      const primaryOffset = phase === 'historical' ? ({ A: -12, B: -11, C: -8, D: -15 }[profile.activityClass] ?? -10) : ({ A: 7, B: 8, C: 9, D: 10 }[profile.activityClass] ?? 8);
      const primaryDay = dateAt(primaryOffset);
      const primaryBase = new Date(`${primaryDay}T${phase === 'historical' ? '20' : '19'}:${String(8 + idNumber % 42).padStart(2, '0')}:00+08:00`).getTime();
      const primaryIds: string[] = [];
      scene.messages.forEach(([speaker, content], index) => {
        const id = `gh2-${profile.id}-${phase[0]}-primary-${index + 1}`;
        primaryIds.push(id);
        const voiced = speaker === 'agent' ? tuneMomentLine(content, profile.agent.archetype || '', id) : content;
        messages.push({ id, runId: GUARDIAN_RUN_ID, personaId: profile.id, phase, sessionId: `${profile.id}-${phase}-primary-v2`, timestamp: new Date(primaryBase + index * 85_000).toISOString(), speaker, content: voiced, sequence: sequence++ });
      });
      scene.memories.forEach((memory, index) => memories.push({ id: `gh2-${profile.id}-${phase[0]}-memory-${index + 1}`, runId: GUARDIAN_RUN_ID, personaId: profile.id, dayKey: primaryDay, phase, domain: memory.domain, kind: memory.kind ?? 'fact', content: memory.content, confidence: memory.kind === 'observed' || memory.kind === 'current_state' ? .76 : .93, evidenceType: memory.kind === 'observed' || memory.kind === 'stable_trait' || memory.kind === 'current_state' ? 'observed' : 'explicit', privacy: memory.privacy ?? 'normal', socialIntent: Boolean(memory.socialIntent), sourceMessageIds: [primaryIds[memory.source]].filter(Boolean), status: 'active', frameworkPath: frameworkFor(memory.domain), dailySummary: memory.content }));
      momentOffsets(profile.activityClass, phase).forEach((offset, momentIndex) => {
        if (offset === primaryOffset) return;
        const day = dateAt(offset);
        const poolIndex = (idNumber * 7 + momentIndex + (phase === 'future' ? 28 : 0)) % everydayMoments.length;
        const moment = everydayMoments[poolIndex];
        const baseHour = 11 + hash(`${profile.id}-${day}`) % 11;
        const baseMinute = hash(`${day}-${profile.id}-guardian`) % 47;
        const base = new Date(`${day}T${String(baseHour).padStart(2, '0')}:${String(baseMinute).padStart(2, '0')}:00+08:00`).getTime();
        moment.forEach(([speaker, rawContent], index) => {
          const id = `gh2-${profile.id}-${phase[0]}-moment-${momentIndex + 1}-${index + 1}`;
          const content = speaker === 'agent' ? tuneMomentLine(rawContent, profile.agent.archetype || '', id) : tuneUserLine(rawContent, profile.id, index, id);
          messages.push({ id, runId: GUARDIAN_RUN_ID, personaId: profile.id, phase, sessionId: `${profile.id}-${phase}-moment-${momentIndex + 1}`, timestamp: new Date(base + index * 70_000).toISOString(), speaker, content, sequence: sequence++ });
        });
      });
    }
  }
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.sequence - b.sequence);
  messages.forEach((message, index) => { message.sequence = index; });
  const run: RunRecord = { id: GUARDIAN_RUN_ID, name: '伴生精灵人感优化v1', status: 'completed', createdAt: `${anchor}T04:00:00.000Z`, completedAt: `${anchor}T04:40:00.000Z`, provider: 'Codex 独立重新生成', model: 'BaZi Guardian Match MVP v1.1', historicalDays: 28, futureDays: 14, densityScale: 50, selectedCount: personaFilter ? 1 : 32, completedCount: personaFilter ? 1 : 32, failedCount: 0, errorSummary: null, promptTemplateId: GUARDIAN_PROMPT_TEMPLATE.id, promptName: GUARDIAN_PROMPT_TEMPLATE.name, userPrompt: GUARDIAN_USER_PROMPT, agentPrompt: GUARDIAN_AGENT_PROMPT, guardianSpec: GUARDIAN_MVP_SPEC, notes: '独立重新生成：不继承旧基线对话；短回复、语用理解、跨日连续性与具体 hook。' };
  return { run, selectedIds: personaFilter ? [personaFilter] : selectedIds, messages, memories, failures: [], personaSource: personaFilter ? getPersonaSource(personaFilter) : undefined };
}
