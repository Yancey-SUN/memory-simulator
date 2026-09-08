import { getPersonaSource, getPersonaSummaries } from './personas';
import type { ChatMessage, MemoryFragment, Phase, RunRecord } from './types';

export const BUILTIN_RUN_ID = 'campus-32-baseline-v1';
const anchor = '2026-09-08';

type Fact = { content: string; domain: string; privacy: string; kind: string };

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

function collectFacts(source: any): Fact[] {
  const facts: Fact[] = [];
  const self = source?.['01_Self_Memory'] ?? {};
  for (const [domain, section] of Object.entries(self)) {
    const visit = (value: any) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== 'object') return;
      if (typeof value.content === 'string' && value.status !== 'unknown' && !/暂无|未充分披露|证据不足/.test(value.content)) {
        facts.push({ content: value.content, domain, privacy: value.privacy ?? 'normal', kind: value.volatility === 'high' ? 'current_state' : value.source === 'observed' ? 'stable_trait' : 'fact' });
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
    };
    visit(section);
  }
  return facts.filter((fact, index) =>
    facts.findIndex((other) => other.content === fact.content) === index &&
    !/MBTI|专业$|学生$|近期身体状态总体稳定|个人身份仍在形成/.test(fact.content) &&
    fact.domain !== 'identity'
  );
}

function compact(text: string, max = 42) {
  return text.replace(/^模拟 MBTI：.+$/, '').replace(/^当前/, '').replace(/[。；]$/, '').replace(/；/g, '，').slice(0, max);
}

const qualifiers = ['也没到特别严重', '就是今天突然又想到了', '我自己也还没完全想明白', '先别给我上价值哈哈', '可能过两天又变了', '反正现在是这么觉得', '我嘴上说无所谓，其实还是会想', '说完好像也没轻松多少', '你先别急着分析', '我就是随口跟你讲一下'];
const reactions = ['我先接住，不急着给它定性。', '嗯，这次和你上回说的语气不太一样。', '这件事确实挺占脑子的。', '可以，先不解决，讲完也算。', '你这句“无所谓”听着就不太无所谓。', '我不替你总结，你继续。', '这倒挺像你会卡住的地方。', '等等，这里好像有个变化。', '先记下今天这个版本，之后再看。', '那今天就不用把答案想完整。'];
const shortReplies = ['哈哈可以', '那倒也是', '行，先这样', '我记得', '懂了', '有点意思', '这句是真的', '先不催你', '然后呢', '你慢慢说'];
const drifts = [
  ['对了，我刚刚还差点坐过站', '你这一路想得也太投入了'],
  ['突然有点想吃学校门口那家面', '可以，先去吃饭，世界晚点再想'],
  ['今天风还挺大的', '很适合把脑子吹空一点'],
  ['我室友又把闹钟按掉了三次', '第四次响你要开始收费了'],
  ['刚才路上看到一只特别胖的猫', '这条信息的重要性突然超过前面全部'],
  ['算了，先去洗个澡', '去吧，别在浴室继续开会就行'],
  ['我手机只剩百分之六了', '那先抢救手机，我们晚点接着聊'],
  ['明天早八，想到就痛苦', '这确实比人生问题更紧急'],
  ['刚刚翻到一张以前的照片', '难怪你一下绕回这件事'],
  ['周末好像要下雨', '那你的出门计划估计又要摇摆了'],
] as const;

function leadFor(fact: Fact, index: number, phase: Phase) {
  const text = compact(fact.content);
  if (/刚入学两周，在/.test(text)) return text.replace('刚入学两周，在', '开学才两周，我还在');
  if (/^完成一次(.+)/.test(text)) return `我那个${text.replace(/^完成一次/, '')}终于弄完了`;
  if (/^高中担任(.+)/.test(text)) return `今天路过广播台，突然想起我高中还做过${text.replace(/^高中担任/, '')}`;
  if (/^第一次离家到(.+)/.test(text)) return `第一次一个人在${text.replace(/^第一次离家到/, '').replace('上大学','')}生活，还是有点不真实`;
  if (fact.domain === 'interest') {
    if (phase === 'historical') {
      if (/播客|音乐|爵士|古典/.test(text)) return `最近又在听${text}`;
      if (/电影|纪录片|财经内容|赛车视频/.test(text)) return `最近又在看${text}`;
      if (/跑步|游泳|羽毛球|篮球|攀岩|骑行|夜骑|排球|街舞/.test(text)) return `最近又开始${text}了`;
      return `最近又有点上头${text}`;
    }
    if (/播客|音乐|爵士|古典/.test(text)) return `这周又开始听${text}了`;
    if (/电影|纪录片|财经内容|赛车视频/.test(text)) return `这周又看了点${text}`;
    if (/阅读|小说|旧地图/.test(text)) return `这周又翻起${text}了`;
    if (/跑步|游泳|羽毛球|篮球|攀岩|骑行|夜骑|排球/.test(text)) return `这周真的又去${text}了`;
    return `这周又在搞${text}`;
  }
  if (fact.domain === 'wellbeing') return `${text}，今天尤其明显`;
  if (fact.domain === 'personality') return `我发现自己好像真会${text}`;
  if (fact.domain === 'inner') return `我现在越来越觉得，${text}`;
  if (fact.domain === 'experience') return index % 2 ? `我刚又想起${text}` : text;
  return phase === 'future' ? `之前说的${compact(text, 28)}，好像往前走了一点` : text;
}

function detailFor(fact: Fact, index: number) {
  const byDomain: Record<string, string[]> = {
    pursuit: ['我今天列了半天计划，最后还是先去吃饭了', '感觉每天都在做决定，但又没有一个真的确定', '本来觉得快想清楚了，下午又变卦', '倒不是不想做，就是脑子里同时开了好多窗口'],
    interest: ['本来只想看五分钟，回过神一个小时没了', '最近忙归忙，这个倒是一直没停', '我朋友说我讲到这个的时候整个人都亮了', '主要是做这个的时候不太会想别的'],
    lifestyle: ['我以前没觉得这是个习惯，最近才发现', '被室友吐槽之后我才注意到', '说不上好不好，反正已经很固定了', '偶尔改一次还会觉得哪里不对'],
    experience: ['当时没觉得什么，今天突然又想起来', '现在回头看还挺像一个分界线的', '我记得那天回去一路都没说话', '后来想想，好像就是从那次开始的'],
    inner: ['我也不知道是不是最近才这么想', '以前我不会直接承认这个', '听着有点矫情，但确实是这样', '我还没想好要不要跟别人讲'],
    personality: ['以前我会嘴硬，现在好像能承认一点了', '但换个场景我可能又不是这样', '所以你先别把这个写死啊', '我自己也经常被自己搞迷糊'],
    wellbeing: ['白天还好，一到晚上就比较明显', '睡一觉可能会好一点，但现在确实烦', '身体比脑子诚实多了', '今天已经是这周第三次了'],
  };
  const options = byDomain[fact.domain] ?? byDomain.inner;
  return options[index % options.length];
}

function sessionOffsets(activityClass: string, phase: Phase, idNumber: number) {
  const historical: Record<string, number[]> = { A: [-27,-23,-19,-15,-11,-7,-3], B: [-26,-19,-12,-5], C: [-23,-9], D: [-17] };
  const future: Record<string, number[]> = { A: [1,4,8,12], B: [2,9], C: [6], D: idNumber % 4 === 0 ? [10] : [] };
  return (phase === 'historical' ? historical : future)[activityClass] ?? (phase === 'historical' ? historical.B : future.B);
}

export function buildBuiltinRun(personaFilter?: string) {
  const profiles = getPersonaSummaries();
  const selectedIds = profiles.map((profile) => profile.id);
  const messages: ChatMessage[] = [];
  const memories: MemoryFragment[] = [];
  let sequence = 0;

  for (const profile of profiles) {
    if (personaFilter && profile.id !== personaFilter) continue;
    const source = getPersonaSource(profile.id);
    const facts = collectFacts(source);
    const idNumber = Number(profile.id.slice(1));
    const normalFacts = facts.filter((fact) => fact.privacy === 'normal');
    const usableFacts = facts.length ? facts : [{ content: profile.currentIssue, domain: 'pursuit', privacy: 'normal', kind: 'current_state' }];
    for (const phase of ['historical', 'future'] as Phase[]) {
      const offsets = sessionOffsets(profile.activityClass, phase, idNumber);
      offsets.forEach((offset, sessionIndex) => {
        const day = dateAt(offset);
        const baseHour = 12 + ((hash(`${profile.id}-${phase}-${sessionIndex}`) % 10));
        const minute = hash(`${day}-${profile.id}`) % 50;
        const base = new Date(`${day}T${String(baseHour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+08:00`).getTime();
        const factA = usableFacts[(sessionIndex * 2 + (phase === 'future' ? 3 : 0)) % usableFacts.length];
        const refIds: string[] = [];
        const bubbleSpecs: Array<['user'|'agent', string, number]> = [
          ['user', leadFor(factA, sessionIndex, phase), 0],
          ['user', detailFor(factA, idNumber + sessionIndex), 1],
          ['agent', reactions[(idNumber + sessionIndex * 2) % reactions.length], 3],
          ['user', qualifiers[(idNumber * 3 + sessionIndex) % qualifiers.length], 5],
          ['agent', shortReplies[(idNumber + sessionIndex * 3) % shortReplies.length], 6],
        ];
        if (profile.activityClass === 'A' || profile.activityClass === 'C') {
          const drift = drifts[(idNumber + sessionIndex) % drifts.length];
          bubbleSpecs.push(['user', drift[0], 9]);
          bubbleSpecs.push(['agent', drift[1], 11]);
        }
        const intent = profile.socialIntent.find((item) => !/暂无|暂不|不主动|再考虑/.test(item));
        if (intent && ((phase === 'historical' && sessionIndex === offsets.length - 1) || (phase === 'future' && sessionIndex === 0))) {
          bubbleSpecs.push(['user', `最近有点想${compact(intent, 30)}`, 14]);
          bubbleSpecs.push(['agent', '这个我记住，但不会替你随便推进。', 16]);
        }
        bubbleSpecs.forEach(([speaker, content, delta], bubbleIndex) => {
          const messageId = `${profile.id}-${phase[0]}-${sessionIndex + 1}-${bubbleIndex + 1}`;
          messages.push({ id: messageId, runId: BUILTIN_RUN_ID, personaId: profile.id, phase, sessionId: `${profile.id}-${phase}-${sessionIndex + 1}`, timestamp: new Date(base + delta * 60000).toISOString(), speaker, content, sequence: sequence++ });
          if (speaker === 'user') refIds.push(messageId);
        });
        memories.push({ id: `${profile.id}-${phase[0]}-${sessionIndex + 1}-mem-1`, runId: BUILTIN_RUN_ID, personaId: profile.id, dayKey: day, phase, domain: factA.domain, kind: factA.kind, content: factA.content, confidence: factA.kind === 'stable_trait' ? .67 : .92, evidenceType: factA.kind === 'stable_trait' ? 'observed' : 'explicit', privacy: factA.privacy, socialIntent: false, sourceMessageIds: [refIds[0]], status: 'active' });
        if (intent && ((phase === 'historical' && sessionIndex === offsets.length - 1) || (phase === 'future' && sessionIndex === 0))) {
          const intentMessage = messages.findLast((message) => message.personaId === profile.id && message.speaker === 'user' && message.content.includes('最近有点想'));
          if (intentMessage) memories.push({ id: `${profile.id}-${phase[0]}-${sessionIndex + 1}-intent`, runId: BUILTIN_RUN_ID, personaId: profile.id, dayKey: day, phase, domain: 'social_intent', kind: 'goal', content: intent, confidence: .94, evidenceType: 'explicit', privacy: 'normal', socialIntent: true, sourceMessageIds: [intentMessage.id], status: 'active' });
        }
      });
    }
  }
  const run: RunRecord = { id: BUILTIN_RUN_ID, name: '校园 32 人基础 Memory', status: 'completed', createdAt: `${anchor}T00:00:00.000Z`, completedAt: `${anchor}T00:30:00.000Z`, provider: 'Codex 直接生成', model: '固定基线 v1', historicalDays: 28, futureDays: 14, densityScale: 40, selectedCount: 32, completedCount: 32, failedCount: 0, errorSummary: null };
  return { run, selectedIds, messages, memories, failures: [], personaSource: personaFilter ? getPersonaSource(personaFilter) : undefined };
}
