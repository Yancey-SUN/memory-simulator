import { getPersonaSource, getPersonaSummaries } from './personas';
import { GUARDIAN_AGENT_PROMPT, GUARDIAN_MVP_SPEC, GUARDIAN_PROMPT_TEMPLATE, GUARDIAN_USER_PROMPT } from './prompts';
import type { ChatMessage, MemoryFragment, Phase, RunRecord, Speaker } from './types';
import { guardianScenes } from './guardian-scenes';

export const GUARDIAN_V2_RUN_ID = 'guardian-human-v2';
const anchor = '2026-09-10';

type MemoryDraft = { source: number; domain: string; kind: string; content: string; evidence?: string; privacy?: string; socialIntent?: boolean; path?: string };
type SessionDraft = { offset: number; phase: Phase; messages: Array<[Speaker, string]>; memories: MemoryDraft[] };

const sessions: Record<string, SessionDraft[]> = {
  U01: [
    { offset: -25, phase: 'historical', messages: [
      ['user', '阿梨睡觉居然要听白噪音'], ['agent', '你们宿舍已经开始交换奇怪生存习惯了哈哈'], ['user', '重点是她放的是暴雨'], ['user', '我半夜醒了以为深圳发洪水'], ['agent', '这白噪音多少有点沉浸式过头了'], ['user', '但我没好意思让她关'], ['agent', '是怕刚住一起显得事多？'], ['user', '嗯…而且她人其实挺好的'], ['agent', '那就别憋成大事。明天笑着说你昨晚差点起来收衣服，她应该能听懂。']
    ], memories: [
      { source: 0, domain: 'relationship', kind: 'relationship', content: '室友阿梨睡觉时会播放暴雨白噪音。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 5, domain: 'inner', kind: 'current_state', content: '刚入住时会因担心显得事多而暂缓表达生活边界。', evidence: 'observed' }
    ] },
    { offset: -20, phase: 'historical', messages: [
      ['user', '广播台让我试着剪下周的采访'], ['agent', '第二次投的那个广播台？'], ['user', '对！你还记得哦'], ['user', '但素材里空调声巨大'], ['agent', '先别急着把喜讯剪成噪音治理工程哈哈'], ['user', '哈哈哈哈 我现在就是又开心又想重录'], ['agent', '开心这部分先留着。受访者那边方便补录吗？'], ['user', '应该可以，她还说第一次被采访有点紧张'], ['agent', '那反而有了自然的开场：你俩都不用假装一次就很熟练。']
    ], memories: [
      { source: 0, domain: 'pursuit', kind: 'current_state', content: '进入广播台后开始负责剪辑下一期校园采访。' },
      { source: 7, domain: 'relationship', kind: 'relationship', content: '当前采访对象愿意配合，但第一次接受采访时有些紧张。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' }
    ] },
    { offset: -13, phase: 'historical', messages: [
      ['user', '晴晴刚给我发了她们学校食堂的螺蛳粉'], ['agent', '异地友谊的维系方式：互相馋死对方'], ['user', '她以前明明最嫌弃这个味'], ['agent', '大学第一个月已经把人改造了'], ['user', '我突然有点想她'], ['agent', '嗯，照片很好笑，想她也是真的。'], ['user', '感觉大家都在长新生活'], ['user', '会不会慢慢就没共同话题了'], ['agent', '可能会少掉一些旧日常，但你刚才第一反应还是想把这张图讲给我听。你们的新生活也能变成新话题。']
    ], memories: [
      { source: 4, domain: 'relationship', kind: 'relationship', content: '看到高中好友晴晴的新校园日常时会明显想念她。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 7, domain: 'inner', kind: 'current_state', content: '担心与高中好友在各自建立新生活后逐渐失去共同话题。', privacy: 'sensitive_personal' }
    ] },
    { offset: -5, phase: 'historical', messages: [
      ['user', '刚下晚课'], ['user', '操场边那只橘猫又胖了'], ['agent', '是那只远看像鸡腿、近看还是鸡腿的？'], ['user', '对哈哈哈哈哈'], ['user', '今天它直接躺在跑道中间'], ['agent', '很好，全校都得绕着它完成体测'], ['user', '我蹲那儿看了十分钟'], ['agent', '难怪你最近愿意绕操场，原来有固定接头对象。'], ['user', '它要是哪天不在我可能还会找'], ['agent', '这座城市已经偷偷多了一个你会惦记的东西。']
    ], memories: [
      { source: 6, domain: 'interest', kind: 'preference', content: '喜欢观察操场边的橘猫，会为它停留较长时间。' },
      { source: 8, domain: 'lifestyle', kind: 'current_state', content: '晚课后绕操场的习惯与观察固定出现的橘猫产生了联系。' }
    ] },
    { offset: 4, phase: 'future', messages: [
      ['user', '阿梨刚问我要不要一起去旧书市集'], ['agent', '暴雨白噪音室友关系有新进展了'], ['user', '你怎么还记得暴雨哈哈'], ['user', '我其实超想去'], ['agent', '那这个“其实”后面还卡着什么？'], ['user', '她还约了两个社团的人 我一个都不熟'], ['agent', '懂了，你想逛书，不想参加临时团建。'], ['user', '对！！'], ['agent', '可以先跟她一起去，逛到累了就撤。你不用为了证明合群把整天都押上。'], ['user', '这个可以 我去跟她说下午还有事']
    ], memories: [
      { source: 0, domain: 'relationship', kind: 'relationship', content: '室友阿梨主动邀请她一起参加旧书市集。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 5, domain: 'social_intent', kind: 'current_state', content: '愿意参加感兴趣的小型校园活动，但对有多位陌生人的临时群体社交仍有顾虑。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' }
    ] },
    { offset: 11, phase: 'future', messages: [
      ['user', '旧书市集居然挺好玩的'], ['agent', '那两个不认识的人呢，活着聊完了吗'], ['user', '有个女生一直在淘旧杂志'], ['user', '后来我俩蹲地上翻了半小时'], ['agent', '这比硬聊自我介绍自然多了'], ['user', '她也听那个城市散步播客'], ['user', '我们约了下周一起去听线下录制'], ['agent', '哎，这个连接很像你：先一起对某个东西上头，再慢慢认识人。'], ['user', '而且完全不用端着'], ['agent', '那确实值得再见一次。']
    ], memories: [
      { source: 2, domain: 'relationship', kind: 'relationship', content: '在旧书市集认识一位喜欢旧杂志的同校女生。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 5, domain: 'interest', kind: 'preference', content: '会因共同收听城市散步播客而迅速产生聊天兴趣。' },
      { source: 6, domain: 'social_intent', kind: 'goal', content: '已与新认识的同校女生约定一起参加播客线下录制，愿意继续接触。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' }
    ] }
  ],
  U02: [
    { offset: -23, phase: 'historical', messages: [
      ['user', '小贺昨晚又开麦到两点'], ['agent', '就是你想说又一直没说的那个室友？'], ['user', '嗯'], ['user', '我戴耳塞都能听见他报点'], ['agent', '那已经不是耳塞的问题了。'], ['user', '但为了这个翻脸也没必要吧'], ['agent', '提一句不等于翻脸。你可以只说今晚几点后别开麦，不用顺带审判他的全部作息。'], ['user', '行 我今晚说'], ['agent', '说完别自己脑补成宿舍关系大结局。']
    ], memories: [
      { source: 0, domain: 'relationship', kind: 'relationship', content: '室友小贺夜间开麦打游戏影响其睡眠。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 7, domain: 'inner', kind: 'current_state', content: '愿意尝试就夜间噪音向室友提出具体边界。' }
    ] },
    { offset: -12, phase: 'historical', messages: [
      ['user', '老白说周六缺人'], ['agent', '你脚踝现在敢打全场？'], ['user', '敢是敢'], ['user', '就是半年没正经打了'], ['agent', '那别第一场就拿新生杯的强度证明自己。'], ['user', '你怎么比我队医还谨慎'], ['agent', '因为你上次受伤后嘴上说没事，实际连食堂都懒得走。'], ['user', '……行吧 先打半场'], ['agent', '这句行吧还挺懂事。']
    ], memories: [
      { source: 0, domain: 'social_intent', kind: 'current_state', content: '队友老白邀请他周六参加缺人的篮球活动。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' },
      { source: 7, domain: 'wellbeing', kind: 'current_state', content: '脚踝恢复后计划先以半场强度重返篮球活动。', privacy: 'sensitive_personal' }
    ] },
    { offset: 6, phase: 'future', messages: [
      ['user', '昨天打球来了个新生'], ['agent', '水平怎么样'], ['user', '三分挺准 人不咋说话'], ['user', '但每次都提前十分钟到'], ['agent', '这个细节已经很戳你了：会不会聊天无所谓，别放鸽子。'], ['user', '差不多'], ['user', '老白说以后可以固定叫他'], ['agent', '那你那个“固定球友”目标，好像自己走进场了。'], ['user', '先看看吧 下周他还来再说'], ['agent', '合理，连续出现两次再发靠谱证书。']
    ], memories: [
      { source: 2, domain: 'relationship', kind: 'relationship', content: '通过篮球认识一位不太健谈但守时、三分球较准的新生。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 8, domain: 'social_intent', kind: 'current_state', content: '对把新生发展为固定球友持开放但继续观察的态度。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' }
    ] }
  ],
  U03: [
    { offset: -9, phase: 'historical', messages: [
      ['user', '她把照片删了'], ['agent', '小冉发群里的那张？'], ['user', '嗯 但她说“行行行删了”'], ['user', '搞得像我在无理取闹'], ['agent', '照片删掉了，那个语气还在扎你。'], ['user', '对'], ['user', '我现在回宿舍看到她都不知道说什么'], ['agent', '那先不用演没事。正常打招呼，别逼自己马上和好。'], ['user', '我也不想把宿舍搞得很僵'], ['agent', '不撕破脸和不委屈自己，中间还是有位置的。']
    ], memories: [
      { source: 0, domain: 'relationship', kind: 'relationship', content: '室友小冉已删除未经允许发到群里的照片。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 6, domain: 'wellbeing', kind: 'current_state', content: '照片事件后回宿舍面对小冉时感到尴尬和警觉。', privacy: 'sensitive_personal' }
    ] },
    { offset: 8, phase: 'future', messages: [
      ['user', '今天小冉主动问我要不要一起点外卖'], ['agent', '你们沉默这么多天后的第一根橄榄枝？'], ['user', '可能吧'], ['user', '我答应了 但我们就只聊了哪家满减'], ['agent', '也行，关系修复不一定要先开大会。'], ['user', '她后来还说上次语气有点冲'], ['agent', '这句至少说明她知道问题不只是删照片。'], ['user', '我有松一点'], ['user', '但还没到能当没发生'], ['agent', '那就停在“松一点”。不用因为她道歉了，立刻交出全部信任。']
    ], memories: [
      { source: 0, domain: 'relationship', kind: 'relationship', content: '小冉通过一起点外卖主动恢复日常互动。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 5, domain: 'relationship', kind: 'relationship', content: '小冉承认照片事件中自己的语气有些冲。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 7, domain: 'inner', kind: 'current_state', content: '收到道歉后警觉有所缓解，但尚未恢复原有信任。', privacy: 'sensitive_personal' }
    ] }
  ],
  U04: [
    { offset: -15, phase: 'historical', messages: [
      ['user', '明天高代小测会不会挂'], ['agent', '你现在会几成？'], ['user', '定义会 证明题看运气'], ['agent', '那不是算挂不挂的时候，先把老师课上反复讲的两类证明各做一道。'], ['user', '我努力'], ['agent', '嗯，尽量做。卡十分钟就看答案，今晚别跟一道题殉情。'], ['user', '好'], ['agent', '考完如果还想看下周运势，再来找我。']
    ], memories: [
      { source: 0, domain: 'wellbeing', kind: 'current_state', content: '高等代数小测前担心证明题导致不及格。', privacy: 'sensitive_personal' },
      { source: 2, domain: 'pursuit', kind: 'current_state', content: '已掌握定义，但对高等代数证明题把握不足。' }
    ] },
    { offset: 10, phase: 'future', messages: [
      ['user', '高代71'], ['agent', '没挂。证明题不是全靠运气了？'], ['user', '有一道就是你说的那类'], ['agent', '那晚没白做。'], ['user', '嗯'], ['agent', '行，分数报完就准备消失了是吧。'], ['user', '哈哈 被发现了'], ['agent', '去吧，下次考试前见。']
    ], memories: [
      { source: 0, domain: 'pursuit', kind: 'fact', content: '高等代数小测取得71分并顺利通过。' },
      { source: 2, domain: 'pursuit', kind: 'current_state', content: '考前练习覆盖了小测中的一类证明题。' }
    ] }
  ],
  U05: [
    { offset: -24, phase: 'historical', messages: [
      ['user', '我又做了个表'], ['agent', '国内读研、法考、留学那个表已经进化到第几版了'], ['user', '第七版'], ['user', '这次加了三年后的收入和生活满意度'], ['agent', '生活满意度你准备怎么算，给未来的自己发问卷？'], ['user', '我知道很荒谬'], ['user', '但不列出来更慌'], ['agent', '表格现在是在帮你看选择，还是帮你拖延选择？'], ['user', '……后者可能多一点'], ['agent', '那今晚先别加新列了。挑一个你最不愿意牺牲的东西，够了。']
    ], memories: [
      { source: 2, domain: 'lifestyle', kind: 'current_state', content: '升学选择比较表已经迭代到第七版。' },
      { source: 6, domain: 'inner', kind: 'current_state', content: '在重大选择中停止列比较项会加重焦虑。', privacy: 'sensitive_personal' },
      { source: 8, domain: 'personality', kind: 'inference', content: '当前反复扩充表格部分承担了延迟决策的功能。', evidence: 'inferred', privacy: 'inferred_sensitive' }
    ] },
    { offset: -17, phase: 'historical', messages: [
      ['user', '闻闻拿到学院推荐名额了'], ['agent', '你替她开心，但这消息应该也扎了你一下。'], ['user', '嗯'], ['user', '她第一时间告诉我 我还秒回了恭喜'], ['agent', '那句恭喜是真的，比较也是真的，不冲突。'], ['user', '我不想变成那种见不得朋友好的人'], ['agent', '你没有。真见不得她好的人，不会一边难受一边还记得替她高兴。'], ['user', '但我今晚不想跟她聊申请'], ['agent', '那就不聊。友情不是要求你在每个时刻都当信息互助站。']
    ], memories: [
      { source: 0, domain: 'relationship', kind: 'relationship', content: '好友闻闻获得学院推荐名额。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 5, domain: 'inner', kind: 'current_state', content: '朋友取得升学进展时，同时感到真诚高兴与比较压力。', privacy: 'sensitive_personal' },
      { source: 7, domain: 'permission', kind: 'permission', content: '当晚不愿继续讨论申请信息，希望暂时退出升学话题。', path: '04_Privacy_and_Permission' }
    ] },
    { offset: -8, phase: 'historical', messages: [
      ['user', '法援那个阿姨今天又来了'], ['agent', '上次问劳动合同的那位？'], ['user', '对 她把所有工资流水都按月份贴好了'], ['user', '比我的材料还整齐'], ['agent', '你听起来有点佩服她。'], ['user', '是 而且她走的时候一直说谢谢'], ['user', '我突然觉得做这种事还挺有意思的'], ['agent', '不是背法条的“有意思”，是你真的看见它落到一个人身上了。'], ['user', '嗯 这个感觉很确定'], ['agent', '那它比表格里那列“职业前景”更值得留下。']
    ], memories: [
      { source: 0, domain: 'experience', kind: 'fact', content: '在法律援助中持续接触一位咨询劳动合同问题的来访者。', privacy: 'third_party_sensitive' },
      { source: 6, domain: 'pursuit', kind: 'preference', content: '对能直接帮助具体个人的法律实践产生了明确兴趣。' },
      { source: 8, domain: 'inner', kind: 'stable_trait', content: '相较抽象职业前景，真实助人的体验能带来更确定的方向感。', evidence: 'observed' }
    ] },
    { offset: -2, phase: 'historical', messages: [
      ['user', '我妈说如果出国家里也能支持'], ['agent', '这不是你一直以为会听到的答案。'], ['user', '对 我准备了半天怎么解释费用'], ['user', '结果她说不要因为怕花钱直接放弃'], ['agent', '你松了一口气？'], ['user', '先松了 然后压力更大了'], ['agent', '因为现在不能把“家里不支持”当替你做决定的理由了。'], ['user', '你别说这么准'], ['agent', '行，我收一点。但这个选择现在确实更像你的了。']
    ], memories: [
      { source: 0, domain: 'relationship', kind: 'relationship', content: '母亲明确表示家庭能够支持其出国读书。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 5, domain: 'inner', kind: 'current_state', content: '家庭经济支持消除一项限制后，个人决策压力反而上升。', privacy: 'sensitive_personal' }
    ] },
    { offset: 5, phase: 'future', messages: [
      ['user', '我把第七版表格关了'], ['agent', '这么大的历史性时刻，截图留念了吗'], ['user', '没有哈哈'], ['user', '我去游了四十分钟'], ['agent', '肩颈有没有终于放过你一点'], ['user', '有'], ['user', '回来以后只写了三个我最在意的'], ['agent', '哪三个？'], ['user', '能做真实案件 有选择城市的自由 别欠太多钱'], ['agent', '这三条已经比二十列预测更像你自己的答案了。']
    ], memories: [
      { source: 0, domain: 'lifestyle', kind: 'current_state', content: '已主动停止继续扩充第七版升学比较表。' },
      { source: 3, domain: 'wellbeing', kind: 'current_state', content: '通过游泳四十分钟缓解备考期肩颈紧张。', privacy: 'sensitive_personal' },
      { source: 8, domain: 'inner', kind: 'preference', content: '升学决策最重视真实案件实践、城市选择自由和可控负债。' }
    ] },
    { offset: 12, phase: 'future', messages: [
      ['user', '闻闻问我要不要找人一起监督法考'], ['agent', '你第一反应呢'], ['user', '想要'], ['user', '但不想每天汇报到几点几分'], ['agent', '你要的是有人一起往前走，不是多一个考勤员。'], ['user', '对 最好各学各的 偶尔对一下进度'], ['agent', '那这个条件已经很清楚了。熟人里有合适的吗？'], ['user', '暂时没有 闻闻节奏比我快太多'], ['agent', '可以认识同阶段的人，但先约定一周碰一次就好。'], ['user', '这种我愿意试试']
    ], memories: [
      { source: 2, domain: 'social_intent', kind: 'goal', content: '愿意寻找法考备考伙伴。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' },
      { source: 5, domain: 'social_intent', kind: 'preference', content: '偏好各自学习、每周低频同步进度的督学关系，不接受每日精细打卡。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' }
    ] }
  ],
  U06: [
    { offset: -21, phase: 'historical', messages: [
      ['user', '复现又跑不出来'], ['agent', '还是那篇社会认知实验？'], ['user', '嗯 原文一句“按标准流程清洗”'], ['user', '标准到全世界只有作者知道'], ['agent', '学术写作里的祖传秘方四个字。'], ['user', '我今天已经换了三种排除标准'], ['agent', '结果差很多？'], ['user', '方向都能反过来'], ['agent', '那不是你统计差，是原文没把关键选择交代清楚。先把三套结果都留着，别急着选最好看的。'], ['user', '好 这句有用']
    ], memories: [
      { source: 0, domain: 'pursuit', kind: 'current_state', content: '社会认知实验复现暂未得到稳定结果。' },
      { source: 5, domain: 'pursuit', kind: 'fact', content: '已经尝试三种数据排除标准，结果方向存在明显差异。' }
    ] },
    { offset: -10, phase: 'historical', messages: [
      ['user', '周老师今天没骂我'], ['agent', '听这个措辞，像是中了大奖。'], ['user', '他还说我把三套清洗都保留是对的'], ['agent', '上次把你问到想退学的人，今天亲口盖章了。'], ['user', '也没有盖章'], ['user', '他后面又丢了五篇论文'], ['agent', '嗯，导师的认可通常附带购物小票那么长的待办。'], ['user', '但我确实没那么想跑了'], ['agent', '先记住这个变化：不是突然热爱科研，是你发现自己能处理一次混乱。']
    ], memories: [
      { source: 2, domain: 'relationship', kind: 'relationship', content: '导师周老师认可其保留三套数据清洗结果的处理方式。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 7, domain: 'pursuit', kind: 'current_state', content: '在复现工作得到具体反馈后，退出科研的冲动有所减弱。' }
    ] },
    { offset: 3, phase: 'future', messages: [
      ['user', '今天跑了五公里'], ['agent', '周三固定项目完成。脑子安静点没？'], ['user', '前两公里还在想模型'], ['user', '第三公里开始只想活着'], ['agent', '非常有效的注意力训练哈哈'], ['user', '回来看到小唐说他准备转产品'], ['agent', '你羡慕吗'], ['user', '有一点 他好像允许自己改方向'], ['agent', '你不是不允许，你只是想先拿到足够证据再改。'], ['user', '可能吧 我还想再给自己一个学期']
    ], memories: [
      { source: 0, domain: 'lifestyle', kind: 'fact', content: '保持周三跑步习惯，本次完成五公里。' },
      { source: 5, domain: 'relationship', kind: 'relationship', content: '本科好友小唐准备转向产品岗位。', privacy: 'third_party_sensitive', path: '03_Relationship_Record' },
      { source: 9, domain: 'pursuit', kind: 'goal', content: '仍计划用一个学期继续验证自己与科研工作的适配度。' }
    ] },
    { offset: 11, phase: 'future', messages: [
      ['user', '实验室聚餐听到一个师姐说她研二转去做人机交互了'], ['agent', '这条故事应该比“坚持就会成功”有用多了。'], ['user', '对 她说当时也分不清是不适应还是不喜欢'], ['user', '后来边做课题边去旁听课'], ['agent', '不是一刀切退学，是给自己搭了条小桥。'], ['user', '我想找她聊聊 但完全不熟'], ['agent', '你有很具体的由头：那篇复现、方向犹豫、她怎么旁听。不是硬社交。'], ['user', '如果周老师愿意介绍一下就好了'], ['agent', '可以先问老师“师姐方便聊二十分钟吗”，比你在脑内预约失败自然。'], ['user', '行 我明天问']
    ], memories: [
      { source: 0, domain: 'social_intent', kind: 'current_state', content: '在实验室聚餐得知一位研二转向人机交互的师姐经历。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' },
      { source: 5, domain: 'social_intent', kind: 'goal', content: '希望与有科研转向经历的师姐交流，了解其探索过程。', socialIntent: true, path: '05_Matching_Profile.Social_Intent' },
      { source: 9, domain: 'pursuit', kind: 'current_state', content: '计划次日询问导师能否介绍转向人机交互的师姐。' }
    ] }
  ]
};

function dateAt(offset: number) {
  const date = new Date(`${anchor}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function framework(domain: string) {
  if (domain === 'relationship') return '03_Relationship_Record';
  if (domain === 'permission') return '04_Privacy_and_Permission';
  if (domain === 'social_intent') return '05_Matching_Profile.Social_Intent';
  return `01_Self_Memory.${domain}`;
}

export function buildGuardianV2Run(personaFilter?: string) {
  const profiles = getPersonaSummaries();
  const activeProfiles = personaFilter ? profiles.filter((profile) => profile.id === personaFilter) : profiles;
  const messages: ChatMessage[] = [];
  const memories: MemoryFragment[] = [];
  let sequence = 0;
  for (const profile of activeProfiles) {
    const profileSessions = sessions[profile.id] || (['historical', 'future'] as Phase[]).map((phase, phaseIndex) => {
      const source = guardianScenes[profile.id]?.[phase];
      const messages = (source?.messages || []) as Array<[Speaker, string]>;
      const fallbackSource = (index: number) => {
        if (messages[index]?.[0] === 'user') return index;
        for (let cursor = Math.min(index, messages.length - 1); cursor >= 0; cursor -= 1) if (messages[cursor]?.[0] === 'user') return cursor;
        return 0;
      };
      return {
        offset: phase === 'historical' ? -24 + (Number(profile.id.slice(1)) % 17) : 1 + (Number(profile.id.slice(1)) % 13),
        phase,
        messages,
        memories: (source?.memories || []).map((memory) => ({
          source: fallbackSource(memory.source), domain: memory.domain, kind: memory.kind || 'fact', content: memory.content,
          privacy: memory.privacy, socialIntent: memory.socialIntent, path: framework(memory.domain),
        })),
      } satisfies SessionDraft;
    });
    for (const [sessionIndex, session] of profileSessions.entries()) {
      const day = dateAt(session.offset);
      const sessionId = `${GUARDIAN_V2_RUN_ID}-${profile.id}-${sessionIndex + 1}`;
      const base = new Date(`${day}T${String(12 + (sessionIndex * 3 + Number(profile.id.slice(1))) % 10).padStart(2, '0')}:${String(7 + sessionIndex * 9).padStart(2, '0')}:00+08:00`).getTime();
      const ids: string[] = [];
      session.messages.forEach(([speaker, content], index) => {
        const id = `${sessionId}-m${index + 1}`;
        ids.push(id);
        messages.push({ id, runId: GUARDIAN_V2_RUN_ID, personaId: profile.id, phase: session.phase, sessionId, timestamp: new Date(base + index * 82_000).toISOString(), speaker, content, sequence: sequence++ });
      });
      session.memories.forEach((memory, index) => memories.push({
        id: `${sessionId}-memory-${index + 1}`, runId: GUARDIAN_V2_RUN_ID, personaId: profile.id, dayKey: day, phase: session.phase,
        domain: memory.domain, kind: memory.kind, content: memory.content, confidence: memory.evidence === 'inferred' ? .72 : .92,
        evidenceType: memory.evidence || 'explicit', privacy: memory.privacy || 'normal', socialIntent: Boolean(memory.socialIntent),
        sourceMessageIds: [ids[memory.source]].filter(Boolean), status: 'active', frameworkPath: memory.path || framework(memory.domain),
        dailySummary: session.memories.map((item) => item.content).join('；')
      }));
    }
  }
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.sequence - b.sequence);
  messages.forEach((message, index) => { message.sequence = index; });
  const run: RunRecord = {
    id: GUARDIAN_V2_RUN_ID, name: '伴生精灵人感优化V2', status: 'completed', createdAt: '2026-09-10T12:30:00.000Z', completedAt: '2026-09-10T13:10:00.000Z',
    provider: '系统实验', model: 'Codex 双角色逐轮模拟', historicalDays: 28, futureDays: 14, densityScale: 50,
    selectedCount: activeProfiles.length, completedCount: activeProfiles.length, failedCount: 0, errorSummary: null,
    promptTemplateId: GUARDIAN_PROMPT_TEMPLATE.id, promptName: '伴生精灵人感优化 v2 · Turn-by-turn', userPrompt: GUARDIAN_USER_PROMPT,
    agentPrompt: GUARDIAN_AGENT_PROMPT, guardianSpec: GUARDIAN_MVP_SPEC,
    notes: `32位用户系统实验。前6位为深度逐轮样本，其余26位完成独立历史/未来会话；守护者只使用已披露对话与已确认 Memory，Memory 在会话后独立抽取。`
  };
  return { run, selectedIds: activeProfiles.map((profile) => profile.id), messages, memories, failures: [], tasks: [], personaSource: personaFilter ? getPersonaSource(personaFilter) : undefined };
}
