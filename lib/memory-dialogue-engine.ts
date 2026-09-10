import type { PersonaSummary, Phase, Speaker } from './types';

type AnyObject = Record<string, any>;

export type DialogueAnchor = {
  domain: string;
  kind: string;
  topic: string;
  memory: string;
  privacy: string;
  person?: string;
  detail?: string;
};

export type DialogueBubble = [Speaker, string];

function validContent(value: unknown) {
  return typeof value === 'string' && value.trim().length > 1 && !/暂无|未知|未披露|证据不足|信息不足|信息有限|敏感信息本身|用于匹配|对信息用途敏感|害怕明确表达需求|行业信息少/.test(value);
}

function itemContent(value: unknown) {
  return typeof value === 'string' ? value : typeof (value as AnyObject)?.content === 'string' ? (value as AnyObject).content : '';
}

function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function compact(value: string, max = 34) {
  return value
    .replace(/^当前(?:正在)?/, '')
    .replace(/^近期/, '')
    .replace(/^用户/, '')
    .replace(/[。；]$/, '')
    .replace(/；/g, '，')
    .slice(0, max);
}

function addMemoryItems(anchors: DialogueAnchor[], domain: string, kind: string, values: unknown, topicPrefix = '') {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const content = itemContent(value);
    if (!validContent(content)) continue;
    anchors.push({
      domain,
      kind: (value as AnyObject)?.volatility === 'high' ? 'current_state' : kind,
      topic: `${topicPrefix}${compact(content, 26)}`,
      memory: content,
      privacy: (value as AnyObject)?.privacy || 'normal',
    });
  }
}

export function collectDialogueAnchors(source: AnyObject, profile: PersonaSummary): DialogueAnchor[] {
  const self = source?.['01_Self_Memory'] || {};
  const anchors: DialogueAnchor[] = [];

  addMemoryItems(anchors, 'interest', 'preference', self.interest?.['爱好'], '兴趣：');
  addMemoryItems(anchors, 'pursuit', 'fact', self.pursuit?.['产出物/成果'], '项目：');
  addMemoryItems(anchors, 'lifestyle', 'fact', self.lifestyle?.['日常习惯'], '日常：');
  addMemoryItems(anchors, 'experience', 'fact', self.experience?.['人生事件'], '经历：');
  addMemoryItems(anchors, 'experience', 'fact', self.experience?.['特别的故事'], '以前的事：');
  addMemoryItems(anchors, 'wellbeing', 'current_state', self.wellbeing?.stressor, '压力：');

  for (const pursuit of self.pursuit?.['正在做的'] || []) {
    for (const blocker of Array.isArray(pursuit?.blocker) ? pursuit.blocker : []) {
      if (validContent(blocker)) anchors.push({ domain: 'pursuit', kind: 'current_state', topic: `卡点：${compact(blocker, 22)}`, memory: blocker, privacy: pursuit?.privacy || 'normal' });
    }
  }

  for (const group of Object.values(source?.['03_Relationship_Record'] || {})) {
    if (!Array.isArray(group)) continue;
    for (const row of group) {
      const person = row?.person?.identity;
      const state = row?.person?.relation_state;
      if (!validContent(person)) continue;
      const detail = [state?.current_dynamic, state?.user_feeling].filter(validContent).join('；');
      anchors.push({ domain: 'relationship', kind: 'relationship', topic: `${person}的近况`, memory: detail ? `${person}：${detail}` : `与${person}的关系`, privacy: 'third_party_sensitive', person, detail });
    }
  }

  const intents = source?.['05_Matching_Profile']?.Social_Intent?.connection_goal?.content;
  if (Array.isArray(intents)) {
    for (const intent of intents) {
      if (!validContent(intent) || /暂无|暂时不/.test(intent)) continue;
      anchors.push({ domain: 'social_intent', kind: 'goal', topic: '最近想认识的人', memory: intent, privacy: 'normal' });
    }
  }

  if (!anchors.length) anchors.push({ domain: 'pursuit', kind: 'current_state', topic: profile.topic || '最近的校园生活', memory: profile.currentIssue || profile.education, privacy: 'normal' });
  return unique(anchors, (anchor) => `${anchor.domain}/${anchor.memory}`);
}

function interestAction(content: string, future: boolean) {
  const prefix = future ? '这周又' : '今天又';
  if (/播客|音乐|歌|爵士|古典|电台/.test(content)) return `${prefix}听了会儿${compact(content, 18)}`;
  if (/电影|纪录片|剧|动画|小说|书|阅读|漫画|展/.test(content)) return `${prefix}看${compact(content, 18)}看到忘时间了`;
  if (/篮球|羽毛球|排球|跑步|游泳|攀岩|骑行|夜骑|徒步|街舞|健身/.test(content)) return `${prefix}去${compact(content, 18)}了`;
  if (/摄影|拍摄/.test(content)) return `${prefix}带相机出去拍了几张`;
  if (/探店|逛店|市集|旧书店/.test(content)) return `${prefix}去${compact(content, 18)}了`;
  if (/游戏/.test(content)) return `${prefix}开了一局${compact(content, 18)}`;
  return `${prefix}折腾${compact(content, 18)}了`;
}

function projectNoun(content: string) {
  return compact(content.replace(/^完成(?:一次)?/, '').replace(/^正在/, ''), 24);
}

function pursuitOpener(content: string) {
  if (/睡眠不足|作息/.test(content)) return `昨晚又没睡够`;
  if (/排名/.test(content)) return `今天看到排名，我又有点卡住了`;
  if (/压力/.test(content)) return `${compact(content, 18)}把我压得有点烦`;
  if (/把所有问题揽到自己身上/.test(content)) return `我今天又下意识把所有问题揽过来了`;
  if (/时间冲突|时间有限|时间不够/.test(content)) return `今天两个安排又撞到一起了`;
  return `今天${compact(content, 22)}又把进度绊住了`;
}

function experienceOpener(content: string) {
  if (/心理咨询/.test(content)) return `刚刚又想起我第一次去做咨询那天`;
  if (/交换申请失败/.test(content)) return `刚刚又想起交换申请出结果那天`;
  if (/第一次担任/.test(content)) return `刚刚又想起第一次当负责人那天`;
  if (/临时退出.*聚会/.test(content)) return `刚刚又想起考试周推掉那两次聚会`;
  return `刚刚突然想起${compact(content, 26)}`;
}

function stressOpener(content: string) {
  if (/宿舍磨合|室友/.test(content)) return `今天宿舍又有点让人累`;
  if (/家庭沟通|家里/.test(content)) return `刚跟家里聊完，脑子又开始嗡嗡的`;
  if (/考试|复习|答辩|论文|求职|申请/.test(content)) return `一想到${compact(content, 18)}我就有点烦`;
  if (/实习/.test(content)) return `一想到还得找实习，我就有点烦`;
  return `${compact(content, 22)}今天又冒出来了`;
}

function firstUserLine(anchor: DialogueAnchor, phase: Phase, episode: number) {
  const future = phase === 'future';
  if (anchor.domain === 'interest') return interestAction(anchor.memory, future);
  if (anchor.domain === 'relationship') return `${anchor.person}今天${episode % 2 ? '又' : ''}跟我说了个事`;
  if (anchor.domain === 'pursuit' && anchor.kind !== 'current_state') {
    const noun = projectNoun(anchor.memory);
    if (/比赛|赛$/.test(noun)) return `我刚把${noun}那一段又顺了一遍`;
    if (/采访/.test(noun)) return `我刚把${noun}的素材又理了一遍`;
    if (/稿|报告|论文|作品|原型|模型|方案|设计/.test(noun)) return `我刚把${noun}又改了一版`;
    return `我刚把${noun}又往前弄了一点`;
  }
  if (anchor.domain === 'pursuit') return pursuitOpener(anchor.memory);
  if (anchor.domain === 'lifestyle') {
    if (/活动前紧张.*开始后/.test(anchor.memory)) return `${episode % 2 ? '刚才' : '今天'}去活动前我又紧张得想溜，真开始以后反而没事了`;
    if (/晚课后常绕操场/.test(anchor.memory)) return `${episode % 2 ? '刚才晚课结束' : '今天晚课结束'}，我又绕操场走了一圈才回宿舍`;
    const habit = compact(anchor.memory, 28).replace(/^(每天|经常|习惯|会)/, '').replace('常绕', '绕').replace('通常', '').replace('倾向', '会');
    return `${future ? '这两天' : '今天'}我又${habit}`;
  }
  if (anchor.domain === 'experience') return experienceOpener(anchor.memory);
  if (anchor.domain === 'wellbeing') return stressOpener(anchor.memory);
  if (anchor.domain === 'social_intent') {
    if (/恢复现有|老朋友|已有朋友/.test(anchor.memory)) return `我考完以后好像终于愿意见人了`;
    if (/搭子|一起|同伴/.test(anchor.memory)) return `刚才一个人弄完那件事，突然觉得有个固定搭子也不错`;
    return `刚刚刷到一个活动群，我居然没马上划走`;
  }
  return `${future ? '上次说的事今天有后续了' : compact(anchor.memory, 30)}`;
}

function chatTopic(anchor: DialogueAnchor) {
  if (anchor.person) return anchor.person;
  if (anchor.domain === 'relationship') return '那个人';
  if (anchor.domain === 'experience') return '那次的事';
  if (anchor.domain === 'wellbeing') {
    if (/宿舍|室友/.test(anchor.memory)) return '宿舍这点事';
    if (/家庭|家里/.test(anchor.memory)) return '跟家里沟通';
    if (/考试|复习/.test(anchor.memory)) return '考试压力';
    return '这阵压力';
  }
  if (anchor.domain === 'lifestyle') return '这个习惯';
  if (anchor.domain === 'social_intent') return '认识新人这件事';
  if (anchor.domain === 'pursuit' && anchor.kind === 'current_state') {
    if (/睡眠/.test(anchor.memory)) return '没睡够';
    if (/排名/.test(anchor.memory)) return '排名';
    if (/复习|考试/.test(anchor.memory)) return '复习压力';
    if (/揽到自己身上/.test(anchor.memory)) return '又把事全揽过来';
    if (/时间冲突|时间有限|时间不够/.test(anchor.memory)) return '时间撞车';
    return compact(anchor.memory, 10);
  }
  if (anchor.domain === 'pursuit') return projectNoun(anchor.memory);
  return compact(anchor.memory, 12);
}

function detailPair(anchor: DialogueAnchor, episode: number): [string, string] {
  const subject = chatTopic(anchor);
  const variant = episode % 4;
  if (anchor.domain === 'social_intent' && /恢复现有|老朋友|已有朋友/.test(anchor.memory)) {
    return [
      ['也不是突然想扩列', '就想先约以前那几个吃顿饭'],
      ['前阵子是真的谁都不想见', '现在回消息没那么费劲了'],
      ['我先从熟人开始吧', '陌生人还是有点累'],
      ['考完以后整个人松了点', '突然又想听他们讲废话了'],
    ][variant] as [string, string];
  }
  if (anchor.domain === 'pursuit' && anchor.kind === 'current_state' && /揽到自己身上/.test(anchor.memory)) {
    return [
      ['我明明只负责自己那块', '最后又顺手把别人的也接了'],
      ['群里一安静我就忍不住补位', '接完又开始后悔'],
      ['其实没人开口让我做', '是我自己怕最后没人收尾'],
      ['我刚才都打好“我来吧”了', '最后忍住没发出去'],
    ][variant] as [string, string];
  }
  if (anchor.domain === 'pursuit' && anchor.kind === 'current_state' && /排名/.test(anchor.memory)) {
    return [
      ['那个数字其实没变多少', '但我看到还是会心里一沉'],
      ['我本来只想确认一下', '结果又把前后几名全看了'],
      ['明明还有机会', '脑子已经开始排练最坏结果了'],
      ['我把页面关了两次', '第三次还是点回去了'],
    ][variant] as [string, string];
  }
  const naturalIntent = compact(anchor.memory, 26).replace(/^(寻找|认识)/, '有个');
  const options: Record<string, Array<[string, string]>> = {
    interest: [
      [`本来只想碰十分钟${subject}`, `结果回过神一个多小时没了`],
      [`最近忙得乱七八糟`, `但${subject}我居然一直没停`],
      [`我朋友说我一聊${subject}就突然话多`, `我还不承认`],
      [`${subject}中间有一段特别戳我`, `我来回看了三遍`],
    ],
    pursuit: [
      anchor.kind === 'current_state' ? [`我本来以为这次能躲开`, `结果还是在${compact(anchor.memory, 20)}这里撞上了`] : [`我对着${subject}磨了半天`, `刚才终于知道该动哪一块了`],
      anchor.kind === 'current_state' ? [`它每次都不是大问题`, `但${compact(anchor.memory, 20)}就是很磨人`] : [`我本来想今天把${subject}全解决`, `现在决定只处理最要命的那个`],
      anchor.kind === 'current_state' ? [`我差点以为整件事都不行`, `冷静一点才发现只是${compact(anchor.memory, 20)}`] : [`刚才差点把${subject}全推翻`, `还好我先关了文档`],
      anchor.kind === 'current_state' ? [`以前只知道烦`, `今天总算能说清是${compact(anchor.memory, 20)}了`] : [`之前最烦的是不知道为什么卡`, `今天至少抓到${subject}了`],
    ],
    lifestyle: [
      [`我以前完全没注意这个习惯`, `被室友说了才发现`],
      [`我还以为只是偶尔这样`, `结果这周已经第三次了`],
      [`说不上这个习惯好不好`, `但不这么做我反而不习惯`],
      [`今天故意换了个顺序`, `浑身都觉得不对劲`],
    ],
    experience: [
      [`当时真没觉得${subject}有多重要`, `现在回头看还挺清楚的`],
      [`说到${subject}，我连那天坐哪都记得`, `其他细节倒忘得差不多了`],
      [`${subject}我以前一直没跟别人讲全`, `讲一半就会拐开`],
      [`也不是突然难过`, `就是${subject}那一幕又跳出来了`],
    ],
    inner: [
      [`以前我会觉得承认“${subject}”有点矫情`, `现在懒得骗自己了`],
      [`${subject}这件事我也不是每次都能做到`, `嘴上说得比较容易`],
      [`“${subject}”我还没想好要不要跟别人讲`, `先跟你说一下`],
      [`${subject}可能过两天我又会改口`, `但现在确实是这么觉得`],
    ],
    wellbeing: [
      [`白天还能装没事`, `一安静下来${subject}就很明显`],
      [`我知道睡一觉可能会好点`, `但现在是真的烦`],
      [`说到${subject}，脑子觉得没什么`, `身体完全不配合`],
      [`压力一上来我连喜欢吃的都没动`, `就想赶紧回去躺着`],
    ],
    relationship: [
      [`${anchor.person}开口时我还以为自己听错了`, `后来发现对方就是那个意思`],
      [`我本来想装没看见${anchor.person}那条消息`, `结果越想越别扭`],
      [`我跟${anchor.person}倒也没有吵起来`, `就是空气突然很怪`],
      [`我回${anchor.person}的时候挺正常`, `回宿舍以后又想了半天`],
    ],
    social_intent: [
      [`我不是想突然加一堆人`, `就是觉得${naturalIntent}好像也不错`],
      [`也不用天天绑着`, `${naturalIntent}就挺好`],
      [`真让我去认识还是会尴尬`, `但想到${naturalIntent}也没那么抗拒了`],
      [`我现在还不会主动冲上去`, `不过${naturalIntent}的话可以先聊聊`],
    ],
  };
  return (options[anchor.domain] || options.inner)[variant];
}

function userVoice(profile: PersonaSummary, text: string, seed: number) {
  const selfDescription = JSON.stringify(profile.tags) + profile.usagePattern;
  if (/高频|分享|外向|活跃/.test(selfDescription) && seed % 4 === 0) return `救命 ${text}`;
  if (/低频|问题导向|谨慎|安静/.test(selfDescription)) return text.replace(/[。！!]/g, '');
  if (seed % 7 === 0) return `怎么说呢，${text}`;
  if (seed % 5 === 0) return text.replace('今天', '今天居然');
  return text;
}

function agentReact(profile: PersonaSummary, anchor: DialogueAnchor, variant: number) {
  const topic = chatTopic(anchor);
  const archetype = profile.agent.archetype;
  if (anchor.domain === 'interest') {
    const lines: Record<string, string[]> = {
      '同行生长型': [`${topic}这条线你一直没丢。`, `又绕回${topic}了，挺好。`, `你碰到${topic}就有劲。`, `${topic}这次像是真喜欢。`],
      '稳燃共振型': [`哈哈哈一说${topic}你就来劲。`, `我就知道${topic}你放不下。`, `又上头${topic}了是吧。`, `好，${topic}这一局我陪你兴奋。`],
      '柔锋型': [`看来${topic}不是三分钟热度。`, `${topic}能留到现在，挺说明问题。`, `忙成这样还碰${topic}，是真喜欢。`, `${topic}这次不是随便看看。`],
      '定流型': [`你一聊${topic}，语气都不一样。`, `${topic}又把你捞回来了。`, `我记得你上次也被${topic}勾住。`, `嗯，${topic}这根线还在。`],
      '松土提气型': [`忙成这样还没丢${topic}，是真喜欢。`, `${topic}倒是一直很稳。`, `行，今天给${topic}留点地方。`, `你在${topic}上还挺长情。`],
    };
    return (lines[archetype || '松土提气型'] || lines['松土提气型'])[variant % 4];
  }
  if (anchor.domain === 'relationship') {
    const lines: Record<string, string[]> = {
      '同行生长型': [`先别猜${topic}后面那十层意思。`, `${topic}这次至少把话递出来了。`, `你先把跟${topic}这段说完。`, `这回你没躲开${topic}。`],
      '稳燃共振型': [`啊？${topic}又有后续了。`, `等等，${topic}这句很会挑事。`, `我就知道${topic}那边没完。`, `好家伙，${topic}真会卡点出现。`],
      '柔锋型': [`${topic}这次确实没处理好。`, `你不舒服不等于你小题大做。`, `${topic}那句话是重点。`, `先别替${topic}找理由。`],
      '定流型': [`我记得，你上次也卡在${topic}这里。`, `${topic}那边果然还有后续。`, `嗯，你在意的还是${topic}那句话。`, `先说${topic}，我跟得上。`],
      '松土提气型': [`嗯，${topic}这个我记得。`, `你跟${topic}之间还没完全松下来。`, `那今天先只说${topic}这件事。`, `${topic}这次听着没上回那么僵。`],
    };
    return (lines[archetype || '松土提气型'] || lines['松土提气型'])[variant % 4];
  }
  if (anchor.domain === 'social_intent') {
    return [`这次听着不是随口一说。`, `你居然没立刻往回缩。`, `可以，先不用把这事放大。`, `先有一点想法就够了。`][variant % 4];
  }
  if (anchor.domain === 'wellbeing') {
    return [`那今天先别硬扛。`, `难怪你说话都没什么电。`, `先把今天过完，不急着解释。`, `嗯，这阵压力还没退。`][variant % 4];
  }
  if (anchor.domain === 'experience') {
    const lines: Record<string, string[]> = {
      '同行生长型': [`嗯，那天的事你还记得很清楚。`, `这次想起来的细节不太一样。`, `先只接住今天冒出来的这一段。`, `那次的事好像又有了新角度。`],
      '稳燃共振型': [`等等，那天的画面又回来了。`, `啊，原来你还记得这个细节。`, `这段你上次讲到一半就拐走了。`, `好，这次不催你讲完整。`],
      '柔锋型': [`先别急着替那次下结论。`, `你记住的这个细节很具体。`, `这次只说事实也可以。`, `不用现在解释它为什么重要。`],
      '定流型': [`那天的画面又浮上来了。`, `我记得，你上次停在这里。`, `嗯，这次是另一个细节。`, `那段还没有完全过去。`],
      '松土提气型': [`嗯，那次的事我记得。`, `今天想起来的是这一小段。`, `不急，你慢慢讲。`, `先放在这里也行。`],
    };
    return (lines[archetype || '松土提气型'] || lines['松土提气型'])[variant % 4];
  }
  if (anchor.domain === 'pursuit') {
    if (anchor.kind === 'current_state') {
      const lines: Record<string, string[]> = {
        '同行生长型': [`好，至少这次知道卡在哪。`, `先只拆${topic}这一小块。`, `别让${topic}把整件事都盖住。`, `这回不跟${topic}硬顶。`],
        '稳燃共振型': [`啊，又是${topic}。`, `这东西是真会挑时间出现。`, `行，今天先跟${topic}打一小局。`, `烦归烦，先别一把全推了。`],
        '柔锋型': [`问题是${topic}，不是你整个人不行。`, `先把${topic}和结果分开。`, `${topic}确实会拖进度。`, `这次至少定位准了。`],
        '定流型': [`我记得，上次也是${topic}拖住你。`, `${topic}又绕回来了。`, `先别顺着${topic}想到最坏。`, `嗯，还是同一个结。`],
        '松土提气型': [`那今天先绕开${topic}一点。`, `嗯，这个确实磨人。`, `先别跟${topic}耗完整晚。`, `今天只处理能动的部分。`],
      };
      return (lines[archetype || '松土提气型'] || lines['松土提气型'])[variant % 4];
    }
    const lines: Record<string, string[]> = {
      '同行生长型': [`这一版终于往前走了。`, `好，先保住这次改对的地方。`, `你没全推翻就已经进步了。`, `这次有个能继续接的头了。`],
      '稳燃共振型': [`终于！这版没白磨。`, `哈哈哈这次文档活下来了。`, `好，先庆祝没推翻重来。`, `这一下总算顺了。`],
      '柔锋型': [`这次改动有落点。`, `嗯，问题比上一版清楚。`, `先保留这一版，别急着重做。`, `至少现在知道为什么要改。`],
      '定流型': [`我记得你上次还想全删掉。`, `这一版终于接上前面的线了。`, `嗯，这次不是原地打转。`, `先把这个版本留住。`],
      '松土提气型': [`行，这一版先存好。`, `总算松下来一点。`, `今天到这里已经够了。`, `先别急着挑下一处毛病。`],
    };
    return (lines[archetype || '松土提气型'] || lines['松土提气型'])[variant % 4];
  }
  switch (profile.agent.archetype) {
    case '同行生长型': return [`欸，${topic}这条线还在继续。`, `${topic}听着有新进展了。`, `先别给${topic}下结论，往下说。`, `你在${topic}上真往前挪了一格。`][variant % 4];
    case '稳燃共振型': return [`啊？${topic}又来剧情了。`, `等等，${topic}这个我得听后续。`, `哈哈哈你果然没放下${topic}。`, `${topic}这一下确实很有感觉。`][variant % 4];
    case '柔锋型': return [`${topic}这次问题很具体。`, `嗯，${topic}这个点比结果重要。`, `你对${topic}没有小题大做。`, `${topic}这次确实不太对。`][variant % 4];
    case '定流型': return [`我记得，上次${topic}也卡在这里。`, `${topic}这事还没真正过去。`, `嗯，${topic}那个细节又冒出来了。`, `你先说${topic}，我跟得上。`][variant % 4];
    default: return [`嗯，${topic}这个我记得。`, `那今天先顺着${topic}聊。`, `${topic}这次听着比上回松一点。`, `行，${topic}先不急着解决。`][variant % 4];
  }
}

function agentHook(profile: PersonaSummary, anchor: DialogueAnchor, variant: number) {
  const questionAllowed = variant % 3 === 0;
  const topic = chatTopic(anchor);
  if (questionAllowed) {
    if (anchor.domain === 'relationship') return `所以你最卡的是${anchor.person}那句话？`;
    if (anchor.domain === 'pursuit') return `现在最难的那一块松了吗？`;
    if (anchor.domain === 'interest') return `${topic}这次最喜欢哪一段？`;
    if (anchor.domain === 'wellbeing') return `今天最累的是哪一下？`;
    if (anchor.domain === 'social_intent') return `这次你比较能接受先线上聊？`;
    if (anchor.domain === 'lifestyle') return `不这么做你会不习惯？`;
    if (anchor.domain === 'experience') return `现在想起来还会有点堵？`;
    return `${topic}后来还有后续吗？`;
  }
  if (anchor.domain === 'social_intent') return `不用现在答应认识谁，先看看这点意愿。`;
  if (anchor.domain === 'wellbeing') return `今天不分析，先给脑子降点噪音。`;
  if (anchor.domain === 'interest') return `${topic}这个话头你想接多久都行。`;
  if (anchor.domain === 'relationship') return `先别替${topic}把没说的话都补完。`;
  if (anchor.domain === 'lifestyle') return `看起来它已经被你过成固定路线了。`;
  if (anchor.domain === 'experience') return `这次先只说你记得最清楚的那一小段。`;
  if (anchor.domain === 'pursuit' && anchor.kind !== 'current_state') return [`先保留这一版，别马上又挑下一处。`, `这次改动先让它待一会儿。`, `至少今天不是原地打转。`, `先存好，明天再看也不迟。`][variant % 4];
  if (anchor.domain === 'pursuit') return `先别让${topic}变成“整件事都不行”。`;
  switch (profile.agent.archetype) {
    case '同行生长型': return `先留住${topic}这个劲，别又开三个坑。`;
    case '稳燃共振型': return `你说${topic}这个语气，一听就没讲完哈哈。`;
    case '柔锋型': return `${topic}先说事实，结论可以晚一点。`;
    case '定流型': return `${topic}这根线先别丢，我还记着。`;
    default: return `今天不用把它想透，先讲到这里也行。`;
  }
}

function closing(profile: PersonaSummary, anchor: DialogueAnchor, variant: number): DialogueBubble[] {
  const domainClosings: Record<string, string[]> = {
    interest: ['哈哈哈我再看一会儿', '行 我把那段存下来', '好吧 确实有点上头', '我晚点再翻一下'],
    pursuit: ['行 我先只改这一处', '我先关会儿文档', '好 先不推翻重来', '我去把最急的弄掉'],
    relationship: ['算了 我先不回', '我再晾一会儿看看', '行 我不替他圆了', '有后续我再来'],
    social_intent: ['先不急着加人吧', '嗯 我先看看', '行 有合适的再说', '我还得缓冲一下'],
    wellbeing: ['嗯 我先去躺会儿', '行 今天不硬撑了', '我去洗个澡再说', '好 先让脑子停一下'],
    lifestyle: ['哈哈哈我尽量改', '算了 明天再试一次', '好吧 被你发现了', '我先照旧一天'],
    experience: ['嗯 讲出来好一点了', '先到这吧', '我缓一会儿', '有点困了 下次讲'],
  };
  const userClosings = anchor.domain === 'pursuit' && anchor.kind === 'current_state'
    ? ['行 我先不管后面那些', '好 先只处理眼前这个', '我先不跟它耗了', '嗯 我把能动的弄完']
    : domainClosings[anchor.domain] || ['嗯 先这样', '行吧 我再看看', '被你说中了点', '好 我晚点有后续再来'];
  const agentClosings: Record<string, string[]> = {
    '同行生长型': ['行，有后续就从这儿接。', '好，先只走下一小步。'],
    '稳燃共振型': ['行，等你的下一集哈哈。', '好，今天先不把兴致聊没。'],
    '柔锋型': ['行，先到这，不硬想。', '可以，等事实再说。'],
    '定流型': ['好，这根线我替你留着。', '嗯，下次不用从头讲。'],
    '松土提气型': ['行，先让今天过去。', '好，别催自己马上有答案。'],
  };
  const user = userClosings[variant % userClosings.length];
  const agentOptions = agentClosings[profile.agent.archetype || '松土提气型'] || agentClosings['松土提气型'];
  return [['user', user], ['agent', agentOptions[variant % agentOptions.length]]];
}

export function buildMemoryLinkedDialogue(profile: PersonaSummary, anchor: DialogueAnchor, phase: Phase, episode: number): DialogueBubble[] {
  const pair = detailPair(anchor, episode);
  const bubbles: DialogueBubble[] = [];
  const moments = ['刚下课', '回宿舍路上', '吃完饭', '洗漱的时候', '排队的时候', '睡前', '午休醒来', '走到操场边', '刚进图书馆', '从食堂出来', '等电梯的时候', '刚写完作业', '回寝室以后', '晚课结束', '刚收拾完桌子', '在便利店排队', '从社团出来', '刚关上电脑', '准备洗澡的时候', '趴了一会儿刚起来', '走回教学楼', '刚坐上校车', '晚饭吃到一半', '从实验室出来', '刚打开手机', '图书馆闭馆前', '回宿舍刚坐下', '准备睡了'];
  const opener = firstUserLine(anchor, phase, episode);
  const contextualOpener = anchor.domain === 'lifestyle' ? opener : `${moments[episode % moments.length]}，${opener}`;
  bubbles.push(['user', userVoice(profile, contextualOpener, episode + Number(profile.id.slice(1)))]);
  if (episode % 2 === 0) bubbles.push(['user', userVoice(profile, pair[0], episode + 3)]);
  bubbles.push(['agent', agentReact(profile, anchor, episode)]);
  bubbles.push(['user', userVoice(profile, episode % 2 === 0 ? pair[1] : `${pair[0]}，${pair[1]}`, episode + 7)]);
  bubbles.push(['agent', agentHook(profile, anchor, episode)]);
  if (episode % 4 !== 1) bubbles.push(...closing(profile, anchor, episode));
  return bubbles;
}

export function futureMemory(anchor: DialogueAnchor, episode: number) {
  const suffixes: Record<string, string[]> = {
    interest: ['仍在持续投入，并出现新的具体体验', '近期主动重新投入该兴趣', '忙碌期间仍保留该兴趣'],
    pursuit: ['在未来两周出现了可辨认的新进展', '开始把目标缩小到一个可执行步骤', '对当前阻碍形成了更具体的判断'],
    relationship: ['近期出现新的互动，用户仍在观察关系变化', '用户对这段关系的感受有了新的具体证据', '双方互动继续发展，但尚未形成稳定结论'],
    lifestyle: ['未来两周仍反复出现，可能是较稳定的生活习惯', '用户尝试调整这一日常习惯', '该生活模式再次得到用户明确提及'],
    wellbeing: ['该状态在未来两周再次出现，仍应视作当前状态', '近期强度有所变化，尚不能固化为稳定人格', '用户补充了这一状态的具体触发场景'],
    social_intent: ['用户在具体场景中再次表达了开放意愿', '用户更明确了希望采用的连接方式', '当前意愿仍存在，但不等于会自动接受推荐'],
    inner: ['用户在新事件中再次表达这一需要', '该看法获得新的对话证据，但仍允许变化', '用户开始更直接地承认这一需要'],
    experience: ['用户在新情境中重新提到这段经历', '这段经历近期再次影响了用户的判断', '用户补充了此前未表达的感受'],
  };
  const suffix = (suffixes[anchor.domain] || suffixes.inner)[episode % 3];
  return `${compact(anchor.memory, 48)}；${suffix}`;
}
