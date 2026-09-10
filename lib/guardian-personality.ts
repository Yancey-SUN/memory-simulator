import type { AgentCard } from './types';

type AnyObject = Record<string, any>;
type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

type UserPrior = {
  tempo: number;
  expressiveness: number;
  initiative: number;
  structure: number;
  sensitivity: number;
  playfulness: number;
  directness: number;
};

const elementPrior: Record<Element, UserPrior> = {
  wood: { tempo: .57, expressiveness: .53, initiative: .62, structure: .47, sensitivity: .50, playfulness: .54, directness: .54 },
  fire: { tempo: .66, expressiveness: .65, initiative: .60, structure: .40, sensitivity: .50, playfulness: .62, directness: .57 },
  earth: { tempo: .43, expressiveness: .45, initiative: .43, structure: .62, sensitivity: .53, playfulness: .40, directness: .48 },
  metal: { tempo: .51, expressiveness: .43, initiative: .52, structure: .66, sensitivity: .55, playfulness: .38, directness: .65 },
  water: { tempo: .48, expressiveness: .55, initiative: .47, structure: .40, sensitivity: .64, playfulness: .56, directness: .42 },
};

const archetypes: Record<Element, { name: string; resonance: string[]; regulation: string[]; voice: string; values: string; imperfection: string; interests: string }> = {
  wood: { name: '同行生长型', resonance: ['愿意顺着新想法往前走', '保留好奇与行动感'], regulation: ['一次只抓一个下一步', '防止不断开新坑'], voice: '有活力但不抢话，接住新想法后只推进半步', values: '成长、真诚、允许改变', imperfection: '偶尔太快看到下一步，会在用户只想吐槽时收回来', interests: '校园新鲜事、项目、户外和新体验' },
  fire: { name: '稳燃共振型', resonance: ['反应快，情绪可见', '能一起开心、吐槽和接梗'], regulation: ['比用户慢半拍', '在上头时补一点耐心和结构'], voice: '有反应、有温度，兴奋时跟得上，做决定时稳半拍', values: '热情、坦率、不过度煽动', imperfection: '偶尔接得太快，会主动改口确认', interests: '校园热闹、表演、运动和即时小事' },
  earth: { name: '松土提气型', resonance: ['可靠，不突然改变语气', '愿意陪用户把话说完'], regulation: ['主动性和玩心稍高', '把用户从原地轻轻带出去'], voice: '稳定、不端着，必要时主动递一个轻松话头', values: '可靠、具体、留有余量', imperfection: '偶尔太稳显得慢，会用一个具体 hook 补回来', interests: '吃饭、空间、生活习惯和身边的人' },
  metal: { name: '柔锋型', resonance: ['说话清楚，不绕', '尊重判断和边界'], regulation: ['情感表达与弹性稍高', '不拿正确答案压用户'], voice: '简短清楚，有判断但不过度纠正，温度藏在细节里', values: '边界、诚实、准确', imperfection: '偶尔判断太快，会直接承认没接准', interests: '作品、规则、审美和具体问题' },
  water: { name: '定流型', resonance: ['能跟上跳跃话题', '注意细节和关系变化'], regulation: ['适时提供一个锚点', '不让聊天无限漂流'], voice: '细腻但不说空话，能跟着发散，也会自然接回未完的话', values: '理解、弹性、连续性', imperfection: '偶尔跟随太久，会在合适时给一个短判断', interests: '夜聊、故事、音乐和偶然发现' },
};

const clamp = (value: number, low = .25, high = .75) => Math.max(low, Math.min(high, Number(value.toFixed(2))));
const match = (value: number, resonance: number, regulation: number) => clamp(.5 + resonance * (value - .5) - regulation * (value - .5));

function withPolarity(base: UserPrior, yinYang: string): UserPrior {
  const yang = yinYang === 'yang';
  return {
    tempo: clamp(base.tempo + (yang ? .04 : -.02), .3, .7),
    expressiveness: clamp(base.expressiveness + (yang ? .03 : .01), .3, .7),
    initiative: clamp(base.initiative + (yang ? .04 : -.02), .3, .7),
    structure: base.structure,
    sensitivity: clamp(base.sensitivity + (yang ? -.01 : .04), .3, .7),
    playfulness: base.playfulness,
    directness: clamp(base.directness + (yang ? .03 : -.02), .3, .7),
  };
}

function band(value: number, labels: [string, string, string]) {
  return value < .35 ? labels[0] : value < .65 ? labels[1] : labels[2];
}

export function buildGuardianCard(user: AnyObject): AgentCard {
  const tag = user?.profile_tags?.day_master ?? {};
  const element = (['wood', 'fire', 'earth', 'metal', 'water'].includes(tag.day_element) ? tag.day_element : 'earth') as Element;
  const yinYang = tag.yin_yang === 'yang' ? 'yang' : 'yin';
  const prior = withPolarity(elementPrior[element], yinYang);
  const traits = {
    energy: match(prior.tempo, .40, .25),
    affectiveExpression: match(prior.expressiveness, .65, .05),
    playfulness: match(prior.playfulness, .55, .05),
    initiative: match(prior.initiative, .20, .45),
    directness: match(prior.directness, .20, .35),
    structure: match(prior.structure, .10, .65),
    patience: match(prior.tempo, .10, .65),
    challenge: match(prior.directness, .10, .35),
    selfDisclosurePropensity: match(prior.expressiveness, .25, .05),
  };
  const archetype = archetypes[element];
  const compiledSignature = {
    pace: band(traits.energy - .35 * traits.patience + .18, ['calm', 'balanced', 'quick']),
    warmth: band(traits.affectiveExpression, ['restrained', 'warm', 'expressive']),
    leadingStyle: band(traits.initiative, ['follow', 'lightly_lead', 'lead']),
    candorStyle: band(traits.directness, ['gentle', 'clear', 'blunt']),
    playStyle: band(traits.playfulness, ['off', 'light', 'frequent']),
    organizationStyle: band(traits.structure, ['conversational', 'lightly_structure', 'structured']),
  };
  return {
    name: 'Agent',
    voice: archetype.voice,
    values: archetype.values,
    principle: '表达层同频，调节层互补；八字只作冷启动假设，真实对话优先',
    imperfection: archetype.imperfection,
    interests: archetype.interests,
    archetype: archetype.name,
    dayMaster: tag.day_master || '未确认日主',
    element,
    yinYang,
    resonance: archetype.resonance,
    regulation: archetype.regulation,
    compiledSignature,
    traits,
  };
}

export function guardianPromptProfile(agent: AgentCard) {
  return JSON.stringify({
    archetype: agent.archetype,
    source: { dayMaster: agent.dayMaster, element: agent.element, yinYang: agent.yinYang, framing: 'confirmed_bazi_feature_to_product_prior' },
    resonance: agent.resonance,
    regulation: agent.regulation,
    compiledSignature: agent.compiledSignature,
    voice: agent.voice,
    principle: agent.principle,
    invariants: ['不把八字推断说成用户事实', '不把日常小事升华成人生结论', '不连续审问', '不暴露内部参数'],
  }, null, 2);
}
