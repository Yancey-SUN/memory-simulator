import { getPersonaSource, getPersonaSummaries } from './personas';
import type { ChatMessage, MemoryFragment, Phase, RunRecord } from './types';
import { baselineScenes } from './baseline-scenes';
import { DEFAULT_AGENT_PROMPT, DEFAULT_PROMPT_TEMPLATE, DEFAULT_USER_PROMPT } from './prompts';

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
const reactions = ['嗯，我在听。', '你这次听起来比上回轻松一点。', '这件事确实挺占脑子的。', '可以，今天先不解决。', '你这句“无所谓”听着就不太无所谓。', '然后呢？', '难怪你会卡在这儿。', '等等，这里好像有变化。', '过几天再看看你会不会改主意。', '那今天不用把答案想完整。'];
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

const naturalExtras: Array<Array<['user'|'agent', string]>> = [
  [['user','自动贩卖机把我的可乐卡住了'],['agent','经典的付一瓶钱看一瓶可乐。'],['user','我拍了两下，旁边又掉下来一瓶'],['agent','很好，现在是买一送一。']],
  [['user','图书馆我常坐的位置灯坏了'],['agent','那个靠窗、插座还特别松的位置？'],['user','对，我居然已经坐出感情了'],['agent','人类会对固定座位产生领地意识。']],
  [['user','食堂阿姨今天给我盛了两勺肉'],['agent','她认出你了，还是手抖方向终于对了？'],['user','我宁愿相信是认出我了哈哈'],['agent','那你明天去验证一下待遇。']],
  [['user','快递柜前面排了二十多个人'],['agent','你买了什么值得排这个队？'],['user','一包袜子'],['agent','袜子本人压力很大。']],
  [['user','出门的时候没下雨，我走到一半暴雨'],['agent','天气专门等你离宿舍最远的时候。'],['user','鞋已经能养鱼了'],['agent','回去先救鞋，别真往里放鱼。']],
  [['user','室友的闹钟从七点响到七点四十'],['agent','她醒了吗？'],['user','她没醒，我们三个全醒了'],['agent','这个闹钟服务对象很广。']],
  [['user','校园单车坐垫今天烫得离谱'],['agent','秋天只是日历上的，坐垫不同意。'],['user','我站着骑到教学楼'],['agent','今日份腿部训练完成。']],
  [['user','洗衣机又吃了我一只袜子'],['agent','宿舍里已经有一个单只袜子收藏馆了吧。'],['user','三只，颜色还都不一样'],['agent','再攒一只可以随机配对。']],
  [['user','我刚在教室捡到一张写满公式的草稿'],['agent','字好看到舍不得扔那种？'],['user','对，像打印出来的'],['agent','而你的草稿像地震监测图。']],
  [['user','社团群突然发了九十九加'],['agent','有正事吗？'],['user','点进去全在接龙表情包'],['agent','好，白点进去一趟哈哈。']],
  [['user','学校门口新开的店排到拐弯'],['agent','你去凑热闹了吗？'],['user','看了一眼价格就走了'],['agent','完成零元探店。']],
  [['user','今天有人把校园卡落在打印店'],['agent','你交给老板了？'],['user','嗯，五分钟后那个人冲回来找'],['agent','你见证了一次小型失而复得。']],
  [['user','早八老师提前十二分钟下课'],['agent','这十二分钟听起来像放假。'],['user','全班收书的声音特别整齐'],['agent','难得的集体默契。']],
  [['user','我点的面少放辣，结果红得发亮'],['agent','老板对“少”有自己的理解。'],['user','吃了两口开始冒汗'],['agent','今天的午饭附赠有氧。']],
  [['user','宿舍门口那棵树突然全黄了'],['agent','昨天路过还没这么明显。'],['user','对，像一晚上换了皮肤'],['agent','这次形容得挺准。']],
  [['user','选修课老师放了半节课电影'],['agent','你居然没睡？'],['user','片子还挺好看，我记下名字了'],['agent','这门课暂时值得五星。']],
  [['user','有人在操场边唱歌，跑调但特别投入'],['agent','你多听了一圈？'],['user','对，第二圈他还在唱'],['agent','体力和勇气都很稳定。']],
  [['user','我今天第一次抢到靠窗的校车座'],['agent','景色有值回早起吗？'],['user','有，路过江边的时候还挺好看'],['agent','那至少这趟没白困。']],
  [['user','打印店老板一眼就知道我要打作业'],['agent','因为你每次都在截止前出现。'],['user','还问我这次怎么提前了两小时'],['agent','进步得到了官方认证。']],
  [['user','楼下有人练了一下午同一段吉他'],['agent','现在你也会弹了吗？'],['user','旋律会哼了，吉他不会'],['agent','被动加入排练。']],
  [['user','我买的酸奶忘在自习室了'],['agent','回去找了吗？'],['user','回去了，它还在桌角等我'],['agent','今天没有发生酸奶失踪案。']],
  [['user','今天点名刚好从我后一个人开始'],['agent','你逃过一劫？'],['user','不，我昨晚背到两点'],['agent','准备充分的时候偏偏不抽。']],
  [['user','社团招新送的帆布袋居然挺好看'],['agent','所以你是为袋子扫码的？'],['user','先拿袋子，再了解社团'],['agent','顺序非常诚实。']],
  [['user','我的耳机只剩左边有声音'],['agent','现在所有歌都是单声道。'],['user','人声像站在我左肩唱'],['agent','沉浸式得有点过头。']],
  [['user','食堂今天把米饭压得像砖'],['agent','可以直接拿去盖宿舍。'],['user','我吃到一半就投降了'],['agent','建筑材料不建议食用。']],
  [['user','刚才路过辩论队，吵得像真的一样'],['agent','你站门口听完了吗？'],['user','听了五分钟，差点想帮一边说话'],['agent','围观群众险些转职。']],
  [['user','宿舍楼下新装了台咖啡机'],['agent','味道怎么样？'],['user','第一口像焦掉的中药'],['agent','至少提神效果听起来很强。']],
  [['user','我在教学楼绕了三圈没找到教室'],['agent','最后在哪？'],['user','就在我第一次路过的门后面'],['agent','校园版回到原点。']],
  [['user','今天风把我的伞吹反了两次'],['agent','第三次它是不是就习惯了？'],['user','第三次我直接收起来淋雨'],['agent','你先结束了这段拉扯。']],
  [['user','寝室突然停电，整层都在叫'],['agent','你们第一反应不是开手电？'],['user','先叫完才想起来手机'],['agent','流程很有仪式感。']],
  [['user','我在旧书摊翻到一本有很多批注的书'],['agent','批注有意思吗？'],['user','比正文还刻薄，我看了半小时'],['agent','你买的是书还是陌生人的吐槽。']],
  [['user','今天体育课分组我又最后一个被挑'],['agent','这次是什么项目？'],['user','排球，我发球还飞到隔壁场'],['agent','至少覆盖范围很广。']],
  [['user','我刚把水杯落在另一栋楼'],['agent','今天第几次折返跑？'],['user','第三次，我怀疑脑子没带出门'],['agent','水杯替你刷了步数。']],
  [['user','食堂新品照片看着特别高级'],['agent','实物呢？'],['user','像照片经历了经济危机'],['agent','摄影师已经尽力了。']],
  [['user','老师突然说下周不上课'],['agent','教室里有人鼓掌吗？'],['user','没人敢，但所有人都坐直了'],['agent','快乐让人姿势端正。']],
  [['user','快递盒大得我以为买错了'],['agent','里面是什么？'],['user','一支笔，剩下全是空气袋'],['agent','这支笔住了单间。']],
  [['user','我今天在操场看见有人遛兔子'],['agent','兔子配合吗？'],['user','不配合，人跟在后面跑'],['agent','到底谁遛谁很难说。']],
  [['user','宿舍窗外那只鸟每天六点准时叫'],['agent','比你闹钟可靠。'],['user','但我不能给它按掉'],['agent','大自然没有稍后提醒。']],
  [['user','我排队买饭的时候前面两个人吵起来了'],['agent','吵什么？'],['user','都说对方先让自己插队'],['agent','一场关于礼貌的没礼貌争论。']],
  [['user','今天晚霞把实验楼玻璃照得特别粉'],['agent','你拍了吗？'],['user','拍了，但手机里灰扑扑的'],['agent','有些颜色就是拒绝被带走。']],
  [['user','自动门今天把我关在中间了'],['agent','你走太快还是它反应太慢？'],['user','我退一步它又开了，来回三次'],['agent','你们进行了一段尴尬的双人舞。']],
  [['user','我在课桌里摸到一颗没拆的糖'],['agent','敢吃吗？'],['user','不敢，拍了照又放回去了'],['agent','留给下一位考古学家。']],
];

function extraOffsets(activityClass: string, phase: Phase) {
  const historical: Record<string, number[]> = {
    A: Array.from({ length: 28 }, (_, index) => index - 28),
    B: Array.from({ length: 14 }, (_, index) => index * 2 - 28),
    C: [-22, -7],
    D: [-17],
  };
  const future: Record<string, number[]> = {
    A: Array.from({ length: 14 }, (_, index) => index),
    B: [0, 2, 4, 6, 8, 10, 12],
    C: [6],
    D: [],
  };
  return (phase === 'historical' ? historical : future)[activityClass] ?? [];
}

const socialIntentScenes: Record<string, { messages: Array<['user'|'agent', string]>; content: string; source: number }> = {
  U01: { messages: [['user','今天下课又是我自己去吃饭'],['agent','你室友时间又都对不上？'],['user','嗯，其实我想找个同校的偶尔一起吃'],['agent','偶尔约，不用每天绑定那种？'],['user','对，还能顺便聊点日常就更好']], content: '希望认识同校、能偶尔一起吃饭并聊日常的稳定朋友', source: 2 },
  U05: { messages: [['user','法考群今天又有人晒进度'],['agent','看完更焦虑了？'],['user','有点，但我其实想找一个能互相报进度的人'],['agent','不是卷排名，就是到点互相喊一下？'],['user','对，同阶段的人会比较懂']], content: '希望认识同阶段升学伙伴，以轻量互报进度的方式互相督促', source: 2 },
  U09: { messages: [['user','原型的传感器又卡住了'],['agent','你们组还是没人专门做实现？'],['user','对，真想认识个懂硬件或者开发的人一起做'],['agent','你负责体验和设计，对方把东西真的跑起来？'],['user','对，而且最好也对社会创新有兴趣']], content: '希望认识懂技术实现且关注社会创新的项目伙伴', source: 2 },
  U13: { messages: [['user','今天投岗位又看到三个用户研究'],['agent','比品牌方向更想点进去？'],['user','嗯，要是能认识正在转这个方向的人就好了'],['agent','可以一起改作品集，也能交换面试消息。'],['user','对，一个人查资料太慢了']], content: '希望认识同阶段、正在转向用户研究的求职伙伴', source: 2 },
  U17: { messages: [['user','朗读会结束以后大家一下就散了'],['agent','你本来还想继续聊那几篇小说？'],['user','对，我想认识那种能长期聊创作和关系的人'],['agent','不一定马上谈恋爱，先能把话聊下去？'],['user','嗯，但遇到喜欢的人我也不排斥']], content: '希望认识能长期聊创作与关系的人，并对新的恋爱可能保持开放', source: 2 },
};

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
    const curated = baselineScenes[profile.id];
    if (curated) {
      for (const phase of ['historical', 'future'] as Phase[]) {
        const scene = curated[phase];
        if (!scene) continue;
        const classOffset = { A: phase === 'historical' ? -20 : 3, B: phase === 'historical' ? -17 : 6, C: phase === 'historical' ? -9 : 9, D: phase === 'historical' ? -24 : 12 }[profile.activityClass];
        const day = dateAt(classOffset);
        const hour = phase === 'historical' ? 20 : 19;
        const base = new Date(`${day}T${hour}:${String(8 + Number(profile.id.slice(1)) % 40).padStart(2,'0')}:00+08:00`).getTime();
        const messageIds: string[] = [];
        scene.messages.forEach(([speaker, content], messageIndex) => {
          const messageId = `${profile.id}-${phase[0]}-curated-${messageIndex + 1}`;
          messageIds.push(messageId);
          messages.push({ id: messageId, runId: BUILTIN_RUN_ID, personaId: profile.id, phase, sessionId: `${profile.id}-${phase}-curated`, timestamp: new Date(base + messageIndex * 90_000).toISOString(), speaker, content, sequence: sequence++ });
        });
        scene.memories.forEach((memory, memoryIndex) => memories.push({ id: `${profile.id}-${phase[0]}-curated-mem-${memoryIndex + 1}`, runId: BUILTIN_RUN_ID, personaId: profile.id, dayKey: day, phase, domain: memory.domain, kind: memory.kind ?? 'fact', content: memory.content, confidence: memory.kind === 'observed' || memory.kind === 'inference' ? .68 : .93, evidenceType: memory.kind === 'observed' || memory.kind === 'inference' || memory.kind === 'stable_trait' ? 'observed' : 'explicit', privacy: memory.privacy ?? 'normal', socialIntent: Boolean(memory.socialIntent), sourceMessageIds: [messageIds[memory.source]].filter(Boolean), status: 'active' }));
        extraOffsets(profile.activityClass, phase).forEach((offset, extraIndex) => {
          const extraDay = dateAt(offset);
          const phaseShift = phase === 'future' ? 28 : 0;
          const first = naturalExtras[(Number(profile.id.slice(1)) * 5 + extraIndex + phaseShift) % naturalExtras.length];
          const intentScene = socialIntentScenes[profile.id];
          const useIntent = Boolean(intentScene && phase === 'historical' && extraIndex === 12);
          const extra = useIntent && intentScene ? intentScene.messages : first;
          const extraBase = new Date(`${extraDay}T${String(12 + hash(`${profile.id}-${extraDay}`) % 10).padStart(2, '0')}:00:00+08:00`).getTime();
          const extraMessageIds: string[] = [];
          extra.forEach(([speaker, content], messageIndex) => {
            const id = `${profile.id}-${phase[0]}-extra-${extraIndex + 1}-${messageIndex + 1}`;
            extraMessageIds.push(id);
            messages.push({ id, runId: BUILTIN_RUN_ID, personaId: profile.id, phase, sessionId: `${profile.id}-${phase}-extra-${extraIndex + 1}`, timestamp: new Date(extraBase + messageIndex * 80_000).toISOString(), speaker, content, sequence: sequence++ });
          });
          if (useIntent && intentScene) {
            const sourceIndex = intentScene.source;
            memories.push({ id: `${profile.id}-${phase[0]}-intent-${extraIndex + 1}`, runId: BUILTIN_RUN_ID, personaId: profile.id, dayKey: extraDay, phase, domain: 'social_intent', kind: 'goal', content: intentScene.content, confidence: .95, evidenceType: 'explicit', privacy: 'normal', socialIntent: true, sourceMessageIds: [extraMessageIds[sourceIndex]].filter(Boolean), status: 'active' });
          }
        });
      }
      continue;
    }
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
  const frameworkFor = (domain: string) => domain === 'relationship' ? '03_Relationship_Record' : domain === 'permission' ? '04_Privacy_and_Permission' : domain === 'social_intent' ? '05_Matching_Profile.Social_Intent' : `01_Self_Memory.${domain}`;
  const dailyGroups = new Map<string, MemoryFragment[]>();
  for (const memory of memories) {
    memory.frameworkPath = frameworkFor(memory.domain);
    const key = `${memory.personaId}/${memory.dayKey}`;
    dailyGroups.set(key, [...(dailyGroups.get(key) ?? []), memory]);
  }
  for (const items of dailyGroups.values()) {
    const summary = items.map((item) => item.content).join('；');
    for (const item of items) item.dailySummary = summary;
  }
  const run: RunRecord = { id: BUILTIN_RUN_ID, name: '校园 32 人 · Vouch 自然对话基线', status: 'completed', createdAt: `${anchor}T00:00:00.000Z`, completedAt: `${anchor}T00:30:00.000Z`, provider: 'Codex 直接生成', model: 'Vouch natural prompt v5', historicalDays: 28, futureDays: 14, densityScale: 50, selectedCount: 32, completedCount: 32, failedCount: 0, errorSummary: null, promptTemplateId: DEFAULT_PROMPT_TEMPLATE.id, promptName: DEFAULT_PROMPT_TEMPLATE.name, userPrompt: DEFAULT_USER_PROMPT, agentPrompt: DEFAULT_AGENT_PROMPT };
  return { run, selectedIds, messages, memories, failures: [], personaSource: personaFilter ? getPersonaSource(personaFilter) : undefined };
}
