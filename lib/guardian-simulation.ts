import { GUARDIAN_AGENT_PROMPT, GUARDIAN_MVP_SPEC, GUARDIAN_PROMPT_TEMPLATE, GUARDIAN_USER_PROMPT } from './prompts';
import { getPersonaSummaries, getPersonaSource } from './personas';
import { guardianScenes } from './guardian-scenes';
import { buildMemoryLinkedDialogue, collectDialogueAnchors, futureMemory } from './memory-dialogue-engine';
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
    const source = getPersonaSource(profile.id) || {};
    const anchors = collectDialogueAnchors(source, profile);
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
        messages.push({ id, runId: GUARDIAN_RUN_ID, personaId: profile.id, phase, sessionId: `${profile.id}-${phase}-primary-v3`, timestamp: new Date(primaryBase + index * 85_000).toISOString(), speaker, content, sequence: sequence++ });
      });
      scene.memories.forEach((memory, index) => memories.push({ id: `gh2-${profile.id}-${phase[0]}-memory-${index + 1}`, runId: GUARDIAN_RUN_ID, personaId: profile.id, dayKey: primaryDay, phase, domain: memory.domain, kind: memory.kind ?? 'fact', content: memory.content, confidence: memory.kind === 'observed' || memory.kind === 'current_state' ? .76 : .93, evidenceType: memory.kind === 'observed' || memory.kind === 'stable_trait' || memory.kind === 'current_state' ? 'observed' : 'explicit', privacy: memory.privacy ?? 'normal', socialIntent: Boolean(memory.socialIntent), sourceMessageIds: [primaryIds[memory.source]].filter(Boolean), status: 'active', frameworkPath: frameworkFor(memory.domain), dailySummary: memory.content }));
      momentOffsets(profile.activityClass, phase).forEach((offset, momentIndex) => {
        if (offset === primaryOffset) return;
        const day = dateAt(offset);
        const anchorIndex = (momentIndex * 3 + idNumber + (phase === 'future' ? 5 : 0)) % anchors.length;
        const anchorItem = anchors[anchorIndex];
        const moment = buildMemoryLinkedDialogue(profile, anchorItem, phase, momentIndex + idNumber);
        const baseHour = 11 + hash(`${profile.id}-${day}`) % 11;
        const baseMinute = hash(`${day}-${profile.id}-guardian`) % 47;
        const base = new Date(`${day}T${String(baseHour).padStart(2, '0')}:${String(baseMinute).padStart(2, '0')}:00+08:00`).getTime();
        const sourceIds: string[] = [];
        moment.forEach(([speaker, rawContent], index) => {
          const id = `gh2-${profile.id}-${phase[0]}-moment-${momentIndex + 1}-${index + 1}`;
          if (speaker === 'user') sourceIds.push(id);
          messages.push({ id, runId: GUARDIAN_RUN_ID, personaId: profile.id, phase, sessionId: `${profile.id}-${phase}-memory-${momentIndex + 1}`, timestamp: new Date(base + index * 70_000).toISOString(), speaker, content: rawContent, sequence: sequence++ });
        });
        const shouldExtract = phase === 'future' || momentIndex % Math.max(1, Math.ceil(anchors.length / 4)) === 0;
        if (shouldExtract && sourceIds[0]) {
          const content = phase === 'future' ? futureMemory(anchorItem, momentIndex + idNumber) : anchorItem.memory;
          memories.push({
            id: `gh3-${profile.id}-${phase[0]}-linked-memory-${momentIndex + 1}`,
            runId: GUARDIAN_RUN_ID,
            personaId: profile.id,
            dayKey: day,
            phase,
            domain: anchorItem.domain,
            kind: anchorItem.kind,
            content,
            confidence: anchorItem.kind === 'current_state' ? .78 : phase === 'future' ? .84 : .92,
            evidenceType: anchorItem.kind === 'current_state' ? 'observed' : 'explicit',
            privacy: anchorItem.privacy,
            socialIntent: anchorItem.domain === 'social_intent',
            sourceMessageIds: [sourceIds[0]],
            status: 'active',
            frameworkPath: frameworkFor(anchorItem.domain),
            dailySummary: `${anchorItem.topic}：${phase === 'future' ? '出现新的对话证据' : '由当天对话还原到原始 Memory'}。`,
          });
        }
      });
    }
  }
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.sequence - b.sequence);
  messages.forEach((message, index) => { message.sequence = index; });
  const run: RunRecord = { id: GUARDIAN_RUN_ID, name: '伴生精灵人感优化v1', status: 'completed', createdAt: `${anchor}T04:00:00.000Z`, completedAt: `${anchor}T04:40:00.000Z`, provider: 'Codex 独立重新生成', model: 'Memory-grounded Guardian v1.2', historicalDays: 28, futureDays: 14, densityScale: 50, selectedCount: personaFilter ? 1 : 32, completedCount: personaFilter ? 1 : 32, failedCount: 0, errorSummary: null, promptTemplateId: GUARDIAN_PROMPT_TEMPLATE.id, promptName: GUARDIAN_PROMPT_TEMPLATE.name, userPrompt: GUARDIAN_USER_PROMPT, agentPrompt: GUARDIAN_AGENT_PROMPT, guardianSpec: GUARDIAN_MVP_SPEC, notes: '每个聊天时段均由该用户原始 Memory 推演；取消跨用户公共场景池，并按 Guardian 原型区分表达。' };
  return { run, selectedIds: personaFilter ? [personaFilter] : selectedIds, messages, memories, failures: [], personaSource: personaFilter ? getPersonaSource(personaFilter) : undefined };
}
