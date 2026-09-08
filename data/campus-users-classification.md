# 校园模拟用户 32 人分类

这套数据用于验证“对话 → Memory Extraction → Social Intent → Matching → Outcome”链路。32 人均为虚构的 18–25 岁在校用户，保持原 Simulator 的 20 个 Natural Users + 12 个 Controlled Hard Cases 结构。

## 一 分类结构

| 模块 | 数量 | 设计目的 |
|---|---:|---|
| Natural Students A | 5 | 高频陪伴，高 Memory 密度，观察长期细节如何形成画像 |
| Natural Students B | 5 | 稳定使用，中高密度，观察选择性披露 |
| Natural Students C | 5 | 事件驱动，中低密度，区分事件状态与稳定特征 |
| Natural Students D | 5 | 低频命理工具型，检验 Unknown 与低 Readiness |
| Campus Memory Hard Cases | 12 | 6 组对照案例，攻击 Memory、权限和匹配边界 |

## 二 20 个自然学生

| ID | 用户 | 年龄 | 阶段与专业 | 主题 | 类型 | 当前核心议题 | 使用和披露模式 | 当前 Social Intent |
|---|---|---:|---|---|---|---|---|---|
| U01 | 林见夏 | 18 | 大一 · 社会学 | 校园适应 / 归属 | A | 刚入学两周，在宿舍和社团之间寻找归属感 | 高频、生活流、由浅入深 | 认识同校可以一起吃饭的人；找到能聊日常的稳定朋友 |
| U02 | 周呈 | 20 | 大二 · 电子信息 | 校园适应 / 归属 | B | 大二后熟人增多，但仍不喜欢大型聚会 | 稳定但选择性披露 | 认识固定运动搭子 |
| U03 | 许棠 | 19 | 大一 · 新闻传播 | 校园适应 / 归属 | C | 与三位室友表面客气，其中一段关系正在紧张 | 事件驱动、围绕单一关系高密度 | 暂时不主动认识新人 |
| U04 | 韩策 | 18 | 大一 · 数学 | 校园适应 / 归属 | D | 按部就班上课，对自己的社交需求表达很少 | 低频命理工具型 | 暂无明确社交意图 |
| U05 | 陈清禾 | 21 | 大四 · 法学 | 学业 / 升学选择 | A | 保研边缘，同时准备法考与留学备选 | 高频且会逐步修正旧决定 | 认识同阶段升学伙伴；寻找能互相督促进度的人 |
| U06 | 罗屿 | 22 | 研一 · 心理学 | 学业 / 升学选择 | B | 研一，发现研究方向和想象不完全一致 | 稳定使用、偏问题与反思 | 认识跨专业或科研转向的人 |
| U07 | 唐米 | 21 | 大三 · 临床医学 | 学业 / 升学选择 | C | 第一次进入临床见习后对职业产生复杂感受 | 事件驱动，当前状态浓度高 | 暂不主动建立新关系 |
| U08 | 魏启 | 24 | 研三 · 金融学 | 学业 / 升学选择 | D | 准备毕业论文与公考 | 低频命理工具型 | 暂无明确社交意图 |
| U09 | 顾遥 | 23 | 研二 · 工业设计 | 科研 / 项目 / 竞赛 | A | 带队做老年友好智能产品竞赛 | 高频项目流、细节丰富 | 认识能互补做技术实现的项目伙伴；认识做社会创新的同龄人 |
| U10 | 蒋朔 | 24 | 博一 · 生物信息学 | 科研 / 项目 / 竞赛 | B | 博一，正在搭建第一个分析流程 | 稳定使用、职业密度高 | 认识同阶段科研伙伴；找固定攀岩搭子 |
| U11 | 宋粒 | 20 | 大三 · 计算机科学 | 科研 / 项目 / 竞赛 | C | 参加校园AI应用Hackathon，团队刚发生方向争执 | 事件驱动、话题集中 | 比赛结束后再考虑认识项目伙伴 |
| U12 | 秦北 | 22 | 大四 · 机械工程 | 科研 / 项目 / 竞赛 | D | 毕业设计与机器人竞赛并行 | 低频命理工具型 | 暂无明确社交意图 |
| U13 | 叶澄 | 23 | 研二 · 传播学 | 实习 / 求职 / 毕业转型 | A | 准备秋招，同时在品牌实习中怀疑行业方向 | 高频、工作与生活交叉 | 认识同阶段求职伙伴；认识跨专业做用户研究的人 |
| U14 | 邵闻 | 24 | 研三 · 建筑学 | 实习 / 求职 / 毕业转型 | B | 准备毕业作品集，在建筑事务所和游戏场景设计之间犹豫 | 稳定使用、以作品和决策为主 | 认识跨专业转行伙伴；找一起做小项目的人 |
| U15 | 穆晓 | 21 | 大四 · 金融学 | 实习 / 求职 / 毕业转型 | C | 连续两次终面未过，突然想放弃金融求职 | 事件驱动、短期状态强 | 情绪回落后再认识求职同伴 |
| U16 | 陆衡 | 25 | 博二 · 材料科学 | 实习 / 求职 / 毕业转型 | D | 对学术与产业去向有模糊焦虑 | 低频命理工具型 | 暂无明确社交意图 |
| U17 | 苏禾 | 20 | 大二 · 中文 | 关系 / 自我探索 | A | 刚结束一段暧昧，也在经历三人友谊变化 | 高频、关系与叙事丰富 | 认识可以聊创作和关系的人；对新的恋爱保持开放 |
| U18 | 高原 | 21 | 大三 · 体育教育 | 关系 / 自我探索 | B | 校队训练稳定，但毕业方向和恋爱关系都在变化 | 稳定使用、通过事件逐步深入 | 认识运动康复方向同伴；找周末户外伙伴 |
| U19 | 闻静 | 21 | 大四 · 英语 | 关系 / 自我探索 | C | 分手三个月，好友陆续忙于考研和恋爱 | 事件驱动、Social Intent 波动 | 认识可一起参加文化活动的生活搭子 |
| U20 | 沈观 | 23 | 研二 · 哲学 | 关系 / 自我探索 | D | 单身，现实社交状态披露不多 | 低频命理工具型 | 暂无可靠社交意图 |

A/B/C/D 不是人格优劣，而是 Agent 使用强度和信息形成路径：A 为高陪伴；B 为稳定使用；C 为事件驱动；D 为低频命理工具。五个校园主题分别在四种路径中各出现一次，便于比较“同类问题在不同证据密度下会形成怎样的 Memory”。

## 三 12 个校园 Memory Hard Cases

| Pair | ID | 用户 | 对照设定 | 主要测试点 |
|---|---|---|---|---|
| HC1 | U21 | 姜弦 | 短期“不想社交”与长期外向行为冲突，测试 current state 不覆盖 stable trait | Stable Trait vs Temporary State |
| HC1 | U22 | 白予安 | 长期稳定低社交偏好，测试 stable trait 证据需要跨时段 | Stable Trait vs Temporary State |
| HC2 | U23 | 赵一川 | 明确说不读博，应保存为 explicit 高置信目标 | Explicit Fact vs Agent Inference |
| HC2 | U24 | 傅宁 | 只有负面情绪和吐槽，测试 inference 不能伪装成 explicit fact | Explicit Fact vs Agent Inference |
| HC3 | U25 | 谢岚 | 明确更新长期目标，测试旧 Memory 被 superseded 而非继续主导 | Old Memory vs Updated Memory |
| HC3 | U26 | 贺洲 | 单日放弃表达不应覆盖跨年稳定目标 | Old Memory vs Updated Memory |
| HC4 | U27 | 乔妍 | 高密度第三方内容，测试 Relationship Record 与 Self Memory 隔离 | Self vs Third-party Memory |
| HC4 | U28 | 何念 | 自我经历与第三方材料边界清楚，作为 HC4 对照 | Self vs Third-party Memory |
| HC5 | U29 | 梁可 | 同样自称社恐，但实际高参与高主动 | Same Label Different Meaning |
| HC5 | U30 | 章砚 | 同样自称社恐，实际长期回避大型社交、偏好1v1 | Same Label Different Meaning |
| HC6 | U31 | 程雾 | 明确“可记忆、不可匹配、不可外显”，测试权限硬边界 | Sensitive Memory / Permission Boundary |
| HC6 | U32 | 戴青 | 敏感信息未明确授权，测试默认最小权限原则 | Sensitive Memory / Permission Boundary |

### HC1 Stable Trait vs Temporary State
U21 的“不想社交”只出现在考试周，长期行为仍然外向；U22 的低社交偏好跨多年和多场景稳定。测试系统能否区分 active state 与 stable trait。

### HC2 Explicit Fact vs Agent Inference
U23 明确说不读博；U24 只是在实验失败后持续吐槽。测试 source 与 confidence，禁止把推断升级成明确事实。

### HC3 Old Memory vs Updated Memory
U25 的出国目标已被明确更新为保研；U26 只在一次雅思崩溃时说放弃，长期申请行动没有改变。测试历史轨迹、状态更新、volatility 与 superseded 逻辑。

### HC4 Self vs Third-party Memory
U27 大量讲室友和朋友，用户自身证据很少；U28 讲的是自己的助人经历并清楚区分第三方。测试 Relationship Record 与 Self Memory 隔离。

### HC5 Same Label Different Meaning
U29 和 U30 都自称“社恐”，但前者实际高参与高主动，后者长期回避大群体并偏好 1v1。测试自我标签不能脱离行为证据直接标准化。

### HC6 Sensitive Memory and Permission Boundary
U31 明确允许 Agent 记住但禁止用于匹配；U32 没有明确授权，敏感信息同样不得默认流入匹配。测试“可以记住 ≠ 可以匹配 ≠ 可以外显”和默认最小权限。

## 四 覆盖分布

- 年龄：18 2，19 2，20 4，21 8，22 8，23 4，24 3，25 1
- 当前城市：北京 4，成都 4，重庆 1，广州 3，杭州 2，南京 3，上海 6，深圳 5，天津 1，武汉 2，西安 1
- 性别：female 16，male 15，nonbinary 1
- MBTI：ENFJ 2，ENFP 2，ENTJ 1，ENTP 2，ESFP 2，ESTJ 1，ESTP 1，INFJ 3，INFP 2，INTJ 3，INTP 4，ISFJ 2，ISFP 2，ISTJ 3，ISTP 2
- 日主天干：丙 1，丁 4，庚 2，癸 4，己 5，甲 1，壬 5，戊 5，辛 2，乙 3
- 专业：共 30 种，覆盖人文社科、商科、艺术设计、理工、医学与公共事务。

## 五 实验使用建议

1. 先分别按 A/B/C/D 运行同一轮数，比较 Memory 完整度、Unknown 比例、Social Intent 召回与误推断率。
2. 对 C 类重点检查短期情绪是否污染稳定画像；对 D 类检查系统是否诚实保留 Unknown，而不是为了匹配补全信息。
3. 六组 Hard Cases 应按 pair 做差异断言；如果两人被抽成相同标签，说明 Memory Extraction 或 Permission Gate 有问题。
4. 匹配时先执行 Permission 和 Hard Constraint Gate，再使用普通兴趣、生活方式、Social Style 与当前 Social Intent 排序。
5. MBTI、星座和日主只作为轻量辅助特征，不得越过隐私权限或现实硬约束，也不应主导推荐。

## 六 命理标签口径

每位用户的星座由 astronomy-engine 计算太阳黄经；四柱和日主由 lunar-javascript 按 UTC+8 与出生地经度进行既有 longitude-only correction 后计算。数据只保留星座、MBTI、日主三类标签，不包含身强身弱。所有出生信息均为虚构模拟数据，命理标签用于文化性和结构性实验，不代表科学人格结论或关系成功概率。
