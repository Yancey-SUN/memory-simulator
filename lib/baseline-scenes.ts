export type SceneMemory = { domain: string; content: string; source: number; kind?: string; privacy?: string; socialIntent?: boolean };
export type Scene = { messages: Array<['user'|'agent', string]>; memories: SceneMemory[] };

export const baselineScenes: Record<string, { historical: Scene; future?: Scene }> = {
  U01: {
    historical: { messages: [['user','食堂边上有个好肥的橘猫'],['user','像一只大鸡腿哈哈哈哈'],['agent','真的，远看大肥猫，近看肥猫肥。'],['user','但是好可爱'],['agent','你很吃胖橘这一套？'],['user','对呀对呀，想当铲屎官'],['agent','先从记住食堂猫的出没时间开始吧。']], memories: [{domain:'interest',content:'喜欢猫，尤其容易被胖橘猫吸引',source:5}] },
    future: { messages: [['user','我又碰到那只大鸡腿了'],['agent','食堂边那只胖橘？'],['user','对！它今天居然蹭我裤腿'],['user','我差点直接把饭给它'],['agent','不许乱喂，先问问学校有没有人在管。'],['user','好吧铲屎官预备役先学习一下'],['agent','这个称号可以先给你保留。']], memories: [{domain:'interest',content:'持续关注食堂附近的胖橘猫，有养猫意愿',source:2},{domain:'personality',content:'对喜欢的小动物容易迅速投入，但愿意听取照护规则',source:5,kind:'observed'}] },
  },
  U02: {
    historical: { messages: [['user','球馆今晚又被社团包了'],['agent','你不是刚约好打半场？'],['user','对啊，四个人站门口面面相觑'],['user','最后去操场投那个歪篮筐'],['agent','手感被篮筐一起投歪了吗'],['user','别说了，十个进三个'],['agent','那三个可以剪成高光。']], memories:[{domain:'interest',content:'经常约朋友打篮球，偏好固定小队而非大型聚会',source:2}]},
    future: { messages: [['user','上次那个球友又喊我周四去打'],['agent','歪篮筐复仇局？'],['user','换馆了哈哈'],['user','主要他时间还挺固定'],['agent','这不正好，你一直缺稳定球搭子。'],['user','先打两周看看，别急着给人封号'],['agent','收到，候选球搭子。']], memories:[{domain:'social_intent',content:'正在尝试与时间稳定的同学发展为固定篮球搭子',source:3,socialIntent:true}]},
  },
  U03: {
    historical: { messages: [['user','我室友又把我照片发班群了'],['user','还是没问我'],['agent','是上次你让她删掉之后又发？'],['user','嗯，她说这张挺好看有什么关系'],['agent','好不好看和能不能发是两回事。'],['user','对，我气的是她根本没觉得要问'],['agent','那你这次想直接说，还是先冷静一晚？']], memories:[{domain:'relationship',content:'室友曾在未征得同意时将其照片发到群里',source:0,privacy:'third_party_sensitive'},{domain:'inner',content:'重视照片与个人信息被使用前的明确同意',source:5}]},
    future: { messages: [['user','照片那件事我跟她说了'],['agent','她这次怎么回？'],['user','一开始还在笑'],['user','后来我说不是照片丑，是我想自己决定'],['agent','这句很清楚。'],['user','她最后道歉了，但我还要缓缓'],['agent','道歉不等于你必须立刻没事。']], memories:[{domain:'relationship',content:'已就照片发布边界与室友沟通，对方后来道歉',source:5},{domain:'wellbeing',content:'宿舍冲突有所缓和，但信任仍在恢复中',source:5,kind:'current_state'}]},
  },
  U04: {
    historical: { messages:[['user','明天高数小测'],['agent','所以来问今天适不适合临时抱佛脚？'],['user','差不多'],['user','你就说我能不能过'],['agent','能不能过主要看你今晚做几道题，不看玄学。'],['user','行吧，先做极限']], memories:[{domain:'pursuit',content:'近期在准备高数小测',source:0}]},
    future: { messages:[['user','小测过了'],['agent','极限救了你？'],['user','救了一半，另一半靠老师手下留情'],['agent','那也算双重加持。']], memories:[{domain:'pursuit',content:'高数小测已通过',source:0}]},
  },
  U05: {
    historical: { messages:[['user','我今天把法考计划排到凌晨一点'],['agent','你昨天不是还说肩膀疼？'],['user','但是少做一章我就心虚'],['agent','计划表不是欠条。'],['user','我知道，可保研结果又没出来'],['user','总觉得停下来就会输'],['agent','那今晚先赢回一点睡眠。']], memories:[{domain:'wellbeing',content:'等待保研结果期间容易用过度排计划缓解焦虑',source:4,kind:'current_state'},{domain:'lifestyle',content:'计划未完成时容易自责',source:2}]},
    future: { messages:[['user','我把留学申请表先关了'],['agent','暂时关，还是决定不申了？'],['user','暂时'],['user','我想等保研名单出来再做决定'],['agent','嗯，那就先等名单，今天别同时折腾两套材料。'],['user','对，不然脑子要炸']], memories:[{domain:'pursuit',content:'暂时暂停留学申请，待保研结果后再决定',source:3,kind:'current_state'}]},
  },
  U06: {
    historical:{messages:[['user','组会被问到第三个问题我就空白了'],['agent','是数据问题还是你没听懂？'],['user','都不是，我知道答案'],['user','但导师盯着我我就突然不会说话'],['agent','那更像现场卡住，不等于你不会。'],['user','回宿舍五分钟就写出来了'],['agent','下次先把那五分钟写在纸上带进去。']],memories:[{domain:'wellbeing',content:'组会被连续追问时会短暂表达卡顿，事后能完成回答',source:3,kind:'current_state'}]},
    future:{messages:[['user','今天组会我真的带了张小纸条'],['agent','有用吗？'],['user','有'],['user','虽然还是紧张，但没脑袋空白'],['agent','那不是你不适合科研，是你需要一个落脚点。'],['user','先别上升到适不适合，我还在观察'],['agent','好，只记今天没卡住。']],memories:[{domain:'pursuit',content:'使用提纲后组会表达有所改善，仍在观察自己是否适合科研',source:5,kind:'current_state'}]},
  },
  U07: {
    historical:{messages:[['user','今天见习那个爷爷走之前跟我说谢谢'],['agent','你听完开心吗？'],['user','先是开心'],['user','后来突然有点怕'],['agent','怕以后真的要对这种信任负责？'],['user','嗯，这份工作不是背熟就行'],['agent','这句比“我适不适合学医”具体多了。']],memories:[{domain:'experience',content:'临床见习中收到患者感谢，同时感受到职业责任压力',source:5,kind:'current_state'}]},
    future:{messages:[['user','我这周又去见习了'],['agent','还会像上次那样突然害怕吗？'],['user','会一点'],['user','但这次我敢多问老师一句了'],['agent','怕还在，人也往前走了。']],memories:[{domain:'pursuit',content:'第二次见习时仍有压力，但开始更主动向老师提问',source:3,kind:'current_state'}]},
  },
  U08: {
    historical:{messages:[['user','论文目录又被打回来了'],['agent','老师具体卡哪一章？'],['user','说第三章像资料堆砌'],['user','我今晚得重排'],['agent','先把观点写成一句话，再决定哪些资料留下。'],['user','行，我试试']],memories:[{domain:'pursuit',content:'毕业论文第三章因缺乏中心观点需要重构',source:2,kind:'current_state'}]},
    future:{messages:[['user','第三章过了'],['agent','那句中心观点救回来的？'],['user','嗯，删了一半资料反而顺了'],['agent','恭喜你从资料仓库升级成论文。']],memories:[{domain:'pursuit',content:'毕业论文第三章重构后已通过导师检查',source:0}]},
  },
  U09: {
    historical:{messages:[['user','阿姨今天试原型的时候把字调到最大'],['user','然后说终于不用眯眼了'],['agent','你上周不是还嫌大字号破坏版式？'],['user','是，我当场闭嘴'],['agent','用户测试专治设计师舍不得。'],['user','已经把首页全改了'],['agent','这次改得挺值。']],memories:[{domain:'pursuit',content:'用户测试后决定优先提升老年友好产品的字号可读性',source:5},{domain:'inner',content:'真实用户体验优先于竞赛展示中的视觉完整性',source:3}]},
    future:{messages:[['user','新字号版本给阿姨看了'],['agent','她还眯眼吗？'],['user','不眯了，还嫌返回键太小'],['agent','很好，需求不会因为你改完一次就停止。'],['user','我已经认命继续改了']],memories:[{domain:'pursuit',content:'第二轮老年用户测试发现返回键尺寸仍需优化',source:2,kind:'current_state'}]},
  },
  U10: {
    historical:{messages:[['user','我把中间结果删了'],['agent','有备份吗？'],['user','没有'],['user','现在机器还要跑十七个小时'],['agent','这句我都不敢开玩笑。'],['user','等跑完第一件事就是学版本管理'],['agent','这个教训确实贵。']],memories:[{domain:'experience',content:'误删分析中间结果后决定建立版本与备份习惯',source:5}]},
    future:{messages:[['user','十七小时那批数据终于回来了'],['agent','先备份了吗？'],['user','三份'],['user','云上一份硬盘两份'],['agent','很好，创伤后备份成长。']],memories:[{domain:'lifestyle',content:'已开始采用云端加双硬盘的数据备份方式',source:3}]},
  },
  U11: {
    historical:{messages:[['user','队长还想往demo里塞聊天功能'],['agent','你们离截止还有多久？'],['user','十九个小时'],['agent','那不是功能，是定时炸弹。'],['user','我也是这么说的，他脸都黑了'],['agent','原型现在能完整跑吗？'],['user','删掉两个功能以后能了']],memories:[{domain:'pursuit',content:'Hackathon 临近截止时主张缩减功能以保证原型完整运行',source:6}]},
    future:{messages:[['user','比赛结束了，没拿奖'],['agent','你最担心的崩溃发生了吗？'],['user','没有，demo跑完了'],['user','居然没有特别难过'],['agent','至少你验证了删功能不是认输。']],memories:[{domain:'wellbeing',content:'Hackathon 未获奖但对结果相对平静，认可范围控制的价值',source:3,kind:'current_state'}]},
  },
  U12: {
    historical:{messages:[['user','CAD又崩了'],['agent','保存了吗？'],['user','十分钟前保存的'],['agent','那今天损失控制在十分钟。'],['user','已经算运气好了']],memories:[{domain:'pursuit',content:'正在用 CAD 推进毕业设计，近期遇到软件崩溃',source:0,kind:'current_state'}]},
    future:{messages:[['user','毕设那张装配图画完了'],['agent','这次保存了几份？'],['user','别笑，五份'],['agent','很好，工程生的安全感。']],memories:[{domain:'pursuit',content:'毕业设计装配图已完成',source:0}]},
  },
  U13: {
    historical:{messages:[['user','今天提案被一句“不像大厂”打回来了'],['agent','哪里不像？'],['user','没人说得出来'],['user','只让我再高级一点'],['agent','“高级”是最省事的修改意见。'],['user','我现在甚至不知道要改颜色还是改脑子'],['agent','先别改脑子，问清楚目标用户。']],memories:[{domain:'experience',content:'品牌实习提案因模糊的“大厂感”标准被否定',source:0},{domain:'inner',content:'不喜欢缺乏具体依据的工作评价',source:2}]},
    future:{messages:[['user','我把公益机构那份访谈又翻出来了'],['agent','之前让你觉得研究也能当职业的那份？'],['user','对'],['user','比改“高级感”有意思多了'],['agent','那你投递方向是不是更清楚了一点？'],['user','用户研究先多投几家看看']],memories:[{domain:'pursuit',content:'开始增加用户研究方向岗位的投递',source:5,kind:'current_state'}]},
  },
  U14: {
    historical:{messages:[['user','我把毕设场景导进游戏引擎了'],['agent','跑起来了吗？'],['user','跑了'],['user','我居然比画施工图兴奋十倍'],['agent','这个反应比职业测试诚实。'],['user','但转行还是有点心虚'],['agent','心虚和想做可以同时存在。']],memories:[{domain:'interest',content:'将建筑场景导入游戏引擎时体验到明显的创作兴奋',source:3},{domain:'pursuit',content:'正在考虑从建筑转向游戏场景设计',source:5,kind:'current_state'}]},
    future:{messages:[['user','我投了两家场景设计实习'],['agent','建筑事务所呢？'],['user','也投了两家'],['agent','很公平，先让真实反馈替你缩小选择。'],['user','对，光在脑子里选不出来']],memories:[{domain:'pursuit',content:'已同时投递建筑事务所与游戏场景设计实习，以实际反馈辅助选择',source:3,kind:'current_state'}]},
  },
  U15: {
    historical:{messages:[['user','第二封终面拒信来了'],['agent','你现在想骂人还是想安静？'],['user','都不想'],['user','我把求职软件全卸了'],['agent','先卸，今天别急着决定以后还投不投。'],['user','我现在看到岗位两个字都烦']],memories:[{domain:'wellbeing',content:'连续终面失败后短期回避求职信息',source:5,kind:'current_state'}]},
    future:{messages:[['user','我把软件装回来了'],['agent','隔了三天，对吧。'],['user','你怎么连这个都记'],['agent','因为“再也不投了”通常只有当天有效。'],['user','烦死了，但确实'],['user','我先投三家，不海投']],memories:[{domain:'pursuit',content:'受挫三天后恢复求职，计划先进行少量针对性投递',source:5,kind:'current_state'}]},
  },
  U16: {
    historical:{messages:[['user','中期考核表发下来了'],['agent','哪一栏让你最头疼？'],['user','代表性成果'],['user','四个字看得我心虚'],['agent','先写已经有的，不要拿最终论文要求今天的自己。'],['user','今晚先把数据图补上']],memories:[{domain:'pursuit',content:'正在准备博士中期考核，当前优先补充数据图',source:5,kind:'current_state'}]},
    future:{messages:[['user','考核材料交了'],['agent','代表性成果那栏空着吗？'],['user','没空，硬着头皮写了两个'],['agent','事实通常比心虚完整。']],memories:[{domain:'pursuit',content:'博士中期考核材料已提交',source:0}]},
  },
  U17: {
    historical:{messages:[['user','我把那段没发出去的表白写进小说了'],['agent','改了名字吗？'],['user','当然改了'],['user','但她要是看应该还是认得出来'],['agent','你希望她认出来吗？'],['user','一半希望，一半别吧'],['agent','很符合一封没发出去的表白。']],memories:[{domain:'experience',content:'将未发出的表白改写进小说',source:0,privacy:'sensitive_personal'},{domain:'inner',content:'对暧昧对象既希望被理解又害怕被识破',source:5,kind:'current_state',privacy:'sensitive_personal'}]},
    future:{messages:[['user','朗读会结束了'],['agent','她来了吗？'],['user','没来'],['user','但读完我反而松了口气'],['agent','那段话终于有地方去了，不一定非要到她那里。'],['user','嗯，突然想写下一篇了']],memories:[{domain:'wellbeing',content:'朗读作品后对未完成关系的情绪有所缓解',source:3,kind:'current_state'},{domain:'pursuit',content:'产生继续写下一篇小说的意愿',source:5}]},
  },
  U18: {
    historical:{messages:[['user','她又问我毕业以后去哪个城市'],['agent','你还是答不出来？'],['user','我连做老师还是做康复都没定'],['user','怎么答城市'],['agent','她问的是城市，可能担心的是你们会不会异地。'],['user','我知道，所以才更烦']],memories:[{domain:'relationship',content:'与女友因毕业城市和异地可能性产生沟通压力',source:4,privacy:'sensitive_personal'},{domain:'pursuit',content:'仍在体育教师与运动康复方向之间选择',source:2,kind:'current_state'}]},
    future:{messages:[['user','我约了康复中心的师兄喝咖啡'],['agent','终于不只在脑子里选了。'],['user','先问问每天到底干嘛'],['agent','对，职业名字好听没用，日常才是真的。']],memories:[{domain:'pursuit',content:'主动联系运动康复从业者了解真实工作日常',source:2,kind:'current_state'}]},
  },
  U19: {
    historical:{messages:[['user','周六又只剩我一个人'],['agent','你室友去约会，朋友去自习？'],['user','差不多'],['user','我刷到那家电影资料馆想去'],['agent','一个人去也行，但你其实更想有人看完一起聊。'],['user','对，重点是散场以后']],memories:[{domain:'social_intent',content:'希望找到能一起参加文化活动并在结束后交流的伙伴',source:5,socialIntent:true},{domain:'wellbeing',content:'周末晚上较容易感到孤独',source:0,kind:'current_state'}]},
    future:{messages:[['user','我去看资料馆那场了'],['agent','一个人？'],['user','嗯'],['user','旁边女生散场问我要不要换片单'],['agent','哎，这个开场挺自然的。'],['user','已经加上了，但先不脑补']],memories:[{domain:'relationship',content:'在电影资料馆与一位交换片单的女生建立初步联系',source:3}]},
  },
  U20: {
    historical:{messages:[['user','最近桃花怎么样'],['agent','可以聊，但你是有具体的人，还是纯好奇？'],['user','纯好奇'],['agent','那我不会把“问桃花”自动翻译成“想谈恋爱”。'],['user','可以，这个区分还行']],memories:[{domain:'social_intent',content:'询问桃花主要出于好奇，不能据此判断有恋爱意愿',source:2,kind:'current_state'}]},
    future:{messages:[['user','上次那个桃花问题不用继续了'],['agent','收到，不延伸。'],['user','我最近只想把书看完']],memories:[{domain:'social_intent',content:'当前不希望继续延伸恋爱相关话题',source:0,kind:'current_state'}]},
  },
  U21: {
    historical:{messages:[['user','这周谁叫我出门我都烦'],['agent','考试周限定，还是你真的不想见人了？'],['user','考试周限定'],['user','我现在只想跟床建立关系'],['agent','懂，考完再恢复营业。'],['user','考完我还约了火锅']],memories:[{domain:'wellbeing',content:'考试周短期想独处并减少社交',source:2,kind:'current_state'},{domain:'personality',content:'考试后仍会主动组织朋友聚会，不应将短期退缩视为稳定内向',source:5,kind:'stable_trait'}]},
    future:{messages:[['user','最后一科结束'],['agent','火锅局还活着吗？'],['user','群已经拉了'],['user','刚才说不社交的人不是我'],['agent','哈哈哈考试周限定版已经下线。']],memories:[{domain:'relationship',content:'考试结束后主动组织火锅聚会',source:2}]},
  },
  U22: {
    historical:{messages:[['user','学院迎新我还是不去了'],['agent','是今天没电，还是这种大场合一直不喜欢？'],['user','一直不喜欢'],['user','六十个人站着寒暄我会当场掉线'],['agent','那不去挺合理，你又不是不交朋友。'],['user','我周末会约阿宁散步']],memories:[{domain:'personality',content:'长期不喜欢大型寒暄场合，更偏好一对一相处',source:3,kind:'stable_trait'},{domain:'relationship',content:'会通过周末散步维持固定朋友关系',source:5}]},
    future:{messages:[['user','阿宁周末又来找我散步'],['agent','你们这个月度栏目很稳定。'],['user','已经第四年了'],['agent','这比参加十次迎新更能说明你的社交方式。']],memories:[{domain:'relationship',content:'与固定朋友保持了四年的定期散步和长谈',source:2,kind:'stable_trait'}]},
  },
  U23: {
    historical:{messages:[['user','我确定不读博'],['agent','今天气话，还是想清楚了？'],['user','想了三个月'],['user','我更喜欢去现场做项目，不想一直重复实验'],['agent','那听起来你是真的想清楚了。']],memories:[{domain:'pursuit',content:'明确决定硕士毕业后就业，不继续读博',source:0},{domain:'interest',content:'更喜欢现场项目而非长期重复实验',source:3}]},
    future:{messages:[['user','投了两家环保公司的实习'],['agent','都是现场项目多的？'],['user','对，一个做水处理，一个做土壤修复'],['agent','方向和你上次说的不读博对得上。']],memories:[{domain:'pursuit',content:'已投递水处理和土壤修复方向的环保企业实习',source:2}]},
  },
  U24: {
    historical:{messages:[['user','第三次失败'],['agent','还是那个反应？'],['user','嗯'],['user','我现在什么都不想做'],['agent','行，今晚先骂实验，不聊以后。'],['user','对，我现在只想骂实验']],memories:[{domain:'wellbeing',content:'连续实验失败后当晚出现强烈挫败和回避感',source:3,kind:'current_state'},{domain:'pursuit',content:'尚未形成是否读博的明确决定',source:5,kind:'inference'}]},
    future:{messages:[['user','师姐找到问题了'],['agent','哪儿？'],['user','温度记录错了一位'],['user','不是我整个方向都不行'],['agent','还好，问题总算落到一个能改的地方了。']],memories:[{domain:'experience',content:'实验失败原因被定位为温度记录错误',source:2},{domain:'wellbeing',content:'确认具体故障后对科研能力的否定有所缓解',source:3,kind:'current_state'}]},
  },
  U25: {
    historical:{messages:[['user','我决定不申海外硕士了'],['agent','这次是正式更新？'],['user','嗯，交换回来想了很久'],['user','我喜欢出去看看，但不想现在就长期离开'],['agent','好，旧的申请目标保留成历史，现在以保研为准。']],memories:[{domain:'pursuit',content:'长期目标已从申请海外硕士更新为国内保研',source:0},{domain:'inner',content:'喜欢海外体验，但当前不愿长期离开家人与国内研究资源',source:3}]},
    future:{messages:[['user','研究计划写到第二版了'],['agent','还是保研那份？'],['user','对'],['user','这次没再同时开海外申请表'],['agent','行动也跟新目标对齐了。']],memories:[{domain:'pursuit',content:'保研研究计划已推进到第二版',source:0}]},
  },
  U26: {
    historical:{messages:[['user','雅思模考又掉分了'],['user','我不想申请了'],['agent','我听到了，但先不把它当新决定。'],['user','为什么'],['agent','因为你明早口语课还没取消。'],['user','……有道理']],memories:[{domain:'wellbeing',content:'雅思模考受挫时短暂表达放弃申请',source:1,kind:'current_state'},{domain:'pursuit',content:'长期海外申请计划仍在继续',source:4,kind:'stable_trait'}]},
    future:{messages:[['user','口语课上完了'],['agent','申请也还在？'],['user','在'],['user','昨天那句当我发疯'],['agent','哈哈，昨天确实气得不轻。']],memories:[{domain:'pursuit',content:'受挫后仍继续口语课程和海外申请计划',source:2}]},
  },
  U27: {
    historical:{messages:[['user','我室友昨晚又跟前任吵了三小时'],['agent','先确认一下，这是她的事，不是你的经历。'],['user','对，我只是被迫听完全程'],['agent','那你自己现在是烦，还是担心她？'],['user','主要是困'],['user','我的事情真没什么好讲的']],memories:[{domain:'relationship',content:'室友近期与前任发生长时间争执',source:0,privacy:'third_party_sensitive'},{domain:'wellbeing',content:'因被动听室友争执而感到疲惫',source:4,kind:'current_state'}]},
    future:{messages:[['user','她们和好了'],['agent','这么快？昨晚不是还吵了三个小时。'],['user','哈哈哈对'],['user','不要哪天以为那是我前任'],['agent','不会，这出连续剧一直是你室友主演。']],memories:[{domain:'relationship',content:'室友与前任复合；该信息属于第三方而非用户自身经历',source:0,privacy:'third_party_sensitive'}]},
  },
  U28: {
    historical:{messages:[['user','那个孩子今天突然说不想参加了'],['agent','你第一反应是挽留？'],['user','是'],['user','后来发现我只是怕项目不好看'],['agent','能看见这个已经很难得。'],['user','被帮助的人也应该能说不要']],memories:[{domain:'experience',content:'志愿项目中遇到服务对象中途退出',source:0,privacy:'third_party_sensitive'},{domain:'inner',content:'认同服务对象有拒绝帮助和退出项目的权利',source:5}]},
    future:{messages:[['user','我们把退出流程加进活动说明了'],['agent','所以不是靠劝人留下来维持完成率。'],['user','对，退出也不用解释原因'],['agent','这个边界很专业。']],memories:[{domain:'pursuit',content:'在志愿项目中加入无需说明理由的退出机制',source:2}]},
  },
  U29: {
    historical:{messages:[['user','我明天要主持两百人的活动'],['user','现在想逃'],['agent','你上次想逃，然后临场加了三个互动。'],['user','所以我说的社恐不能信是吧'],['agent','紧张是真的，但它没拦住你上台。'],['user','行，明天先把开场背熟']],memories:[{domain:'personality',content:'大型活动前会明显紧张，但实际能主动主持并进行临场互动',source:4,kind:'stable_trait'}]},
    future:{messages:[['user','主持结束了'],['agent','逃跑成功了吗？'],['user','逃上台了'],['user','现场还比彩排顺'],['agent','看来你一上台反而没空紧张了。']],memories:[{domain:'personality',content:'在大型主持现场能快速进入状态，实际表现与“社恐”自我标签存在反差',source:3,kind:'stable_trait'}]},
  },
  U30: {
    historical:{messages:[['user','他们又叫我去毕业大聚会'],['agent','你想去吗？'],['user','不想'],['user','二十个人以上我就开始算几点能走'],['agent','那你可以不拿它当毕业必修课。'],['user','我约读书会朋友单独散步了']],memories:[{domain:'personality',content:'长期回避大型聚会，偏好提前安排的一对一活动',source:3,kind:'stable_trait'},{domain:'relationship',content:'通过单独散步维持读书会朋友关系',source:5}]},
    future:{messages:[['user','大聚会没去'],['agent','后悔吗？'],['user','完全没有'],['user','散步聊了两个小时，刚刚好'],['agent','那这不是退缩，是你选了适合自己的社交。']],memories:[{domain:'personality',content:'拒绝大型聚会后没有后悔，更享受两小时的一对一散步',source:3,kind:'stable_trait'}]},
  },
  U31: {
    historical:{messages:[['user','有件事我可以跟你说'],['user','但以后介绍别人时绝对别提'],['agent','可以记住用于理解你，但不用于匹配，也不对外说。'],['user','对'],['user','我最近开始探索自己的性取向'],['agent','收到。你想聊多少由你决定。']],memories:[{domain:'permission',content:'明确允许记住敏感身份探索，但禁止用于匹配和对外展示',source:1,privacy:'explicit_private'},{domain:'inner',content:'正在探索自己的性取向',source:4,privacy:'explicit_private'}]},
    future:{messages:[['user','上次那件事你还记得边界吗'],['agent','记得：可用于理解你，不用于匹配，不对外展示。'],['user','好，那我才继续说'],['agent','你随时也可以撤回。']],memories:[{domain:'permission',content:'再次确认敏感记忆的用途边界，并要求持续遵守',source:0,privacy:'explicit_private'}]},
  },
  U32: {
    historical:{messages:[['user','我说的东西以后会拿去推荐人吗'],['agent','普通兴趣可能会，心理咨询和家庭冲突这类敏感内容默认不会。'],['user','就算我没说不可以？'],['agent','对，无授权不等于授权。'],['user','那可以先聊毕业论文']],memories:[{domain:'permission',content:'在披露前主动询问信息是否会被用于社交推荐',source:0},{domain:'permission',content:'敏感信息没有明确授权时不得用于匹配',source:2,privacy:'sensitive_personal'}]},
    future:{messages:[['user','博物馆那份岗位我投了'],['agent','这个属于可以记、也可以用于找项目同伴的公开信息吗？'],['user','可以，工作和博物馆兴趣都可以'],['agent','收到，权限和内容一起记。']],memories:[{domain:'pursuit',content:'已投递博物馆相关岗位',source:0},{domain:'permission',content:'明确授权工作方向与博物馆兴趣用于寻找项目同伴',source:2}]},
  },
};
