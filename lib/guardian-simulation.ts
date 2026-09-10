import { buildBuiltinRun } from './builtin-simulation';
import { GUARDIAN_AGENT_PROMPT, GUARDIAN_MVP_SPEC, GUARDIAN_PROMPT_TEMPLATE, GUARDIAN_USER_PROMPT } from './prompts';
import { getPersonaSummaries, getPersonaSource } from './personas';
import type { ChatMessage, MemoryFragment, RunRecord } from './types';

export const GUARDIAN_RUN_ID = 'guardian-human-v1';
const anchor = '2026-09-10';

const variants: Record<string, Record<string, string[]>> = {
  '同行生长型': {
    '嗯，我在听。': ['嗯，你接着说', '然后呢，我跟上了'],
    '然后呢？': ['然后呢？', '后面还有吧？'],
    '懂了': ['懂了，先到这儿', '行，我跟上了'],
    '行，先这样': ['行，先往前挪一点', '行，今天先到这儿'],
    '我记得': ['记得，后面还有变化吧', '嗯，是上次那个'],
  },
  '稳燃共振型': {
    '嗯，我在听。': ['嗯嗯，你继续', '在听在听'],
    '然后呢？': ['然后呢然后呢', '等等，然后呢？'],
    '懂了': ['懂了哈哈', '啊，懂了'],
    '行，先这样': ['行，先这样，别加码', '好，今天先这样'],
    '我记得': ['记得啊', '记得，就是上次那个'],
  },
  '松土提气型': {
    '嗯，我在听。': ['嗯，你慢慢说', '我在，继续说'],
    '然后呢？': ['后面呢？', '嗯，后来呢？'],
    '懂了': ['嗯，懂了', '好，这下懂了'],
    '行，先这样': ['行，今天先这样', '好，先别逼自己想完'],
    '我记得': ['嗯，我记得', '记得，是那件事'],
  },
  '柔锋型': {
    '嗯，我在听。': ['嗯，继续', '我在听'],
    '然后呢？': ['然后？', '后面呢？'],
    '懂了': ['懂了', '行，明白了'],
    '行，先这样': ['行，先这样', '可以，先停这儿'],
    '我记得': ['记得', '是上次那个'],
  },
  '定流型': {
    '嗯，我在听。': ['嗯，我跟着呢', '在听，你继续'],
    '然后呢？': ['然后呢，我感觉还有后半句', '后来呢？'],
    '懂了': ['嗯，这下接上了', '懂了，原来卡在这儿'],
    '行，先这样': ['行，先放这儿', '好，晚点想起再接着说'],
    '我记得': ['记得，这条线还没断', '嗯，是上次那件事'],
  },
};

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return Math.abs(value >>> 0);
}

function optimizeAgentLine(line: string, archetype: string, previousUser: string, key: string) {
  if (/这个我记住，但不会替你随便推进/.test(line)) return '嗯，这个想法已经挺具体了';
  if (/努力去实现这个目标是很好的/.test(line)) return '好，尽量就行，别给自己加码';
  if (/我不会把你改写|信息密度|画像|Memory|匹配系统/.test(line)) return '嗯，我知道你现在不是一直都这样';
  const choices = variants[archetype]?.[line];
  let result = choices?.[hash(key) % choices.length] ?? line;
  if (/^我努力[。！!？?]*$/.test(previousUser.trim())) result = archetype === '稳燃共振型' ? '好哈哈，尽量就行，别又给自己加码' : '好，尽量就行，没做到也没事';
  if (/^算了[。！!？?]*$/.test(previousUser.trim())) result = '行，那今天先不碰它';
  if (/^都可以[。！!？?]*$/.test(previousUser.trim())) result = '那就挑最省事的那个';
  if (/^还行[。！!？?]*$/.test(previousUser.trim())) result = '这个“还行”听着很保留';
  if (archetype === '柔锋型') result = result.replace(/^这件事确实/, '这事').replace(/。$/, '');
  if (archetype === '稳燃共振型' && /^(很好|可以)$/.test(result)) result = `${result}哈哈`;
  return result.slice(0, 58);
}

export function buildGuardianOptimizedRun(personaFilter?: string) {
  const base = buildBuiltinRun(personaFilter);
  const profiles = new Map(getPersonaSummaries().map((profile) => [profile.id, profile]));
  const idMap = new Map<string, string>();
  const previousUser = new Map<string, string>();
  const messages: ChatMessage[] = base.messages.map((message) => {
    const id = message.id.replace(/^/, 'gh1-');
    idMap.set(message.id, id);
    if (message.speaker === 'user') previousUser.set(message.personaId, message.content);
    const profile = profiles.get(message.personaId);
    const content = message.speaker === 'agent' && profile
      ? optimizeAgentLine(message.content, profile.agent.archetype || '', previousUser.get(message.personaId) || '', message.id)
      : message.content;
    return { ...message, id, runId: GUARDIAN_RUN_ID, content };
  });
  const memories: MemoryFragment[] = base.memories.map((memory) => ({
    ...memory,
    id: `gh1-${memory.id}`,
    runId: GUARDIAN_RUN_ID,
    sourceMessageIds: memory.sourceMessageIds.map((id) => idMap.get(id)).filter(Boolean) as string[],
  }));
  const run: RunRecord = {
    id: GUARDIAN_RUN_ID,
    name: '伴生精灵人感优化v1',
    status: 'completed',
    createdAt: `${anchor}T02:00:00.000Z`,
    completedAt: `${anchor}T02:32:00.000Z`,
    provider: 'Codex 直接生成',
    model: 'BaZi Guardian Match MVP v1',
    historicalDays: 28,
    futureDays: 14,
    densityScale: 50,
    selectedCount: personaFilter ? 1 : 32,
    completedCount: personaFilter ? 1 : 32,
    failedCount: 0,
    errorSummary: null,
    promptTemplateId: GUARDIAN_PROMPT_TEMPLATE.id,
    promptName: GUARDIAN_PROMPT_TEMPLATE.name,
    userPrompt: GUARDIAN_USER_PROMPT,
    agentPrompt: GUARDIAN_AGENT_PROMPT,
    guardianSpec: GUARDIAN_MVP_SPEC,
  };
  return { run, selectedIds: personaFilter ? [personaFilter] : base.selectedIds, messages, memories, failures: [], personaSource: personaFilter ? getPersonaSource(personaFilter) : undefined };
}
