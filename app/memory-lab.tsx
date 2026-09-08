'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage, MemoryFragment, PersonaSummary, RunRecord } from '@/lib/types';

type RunData = { run: RunRecord; selectedIds: string[]; messages: ChatMessage[]; memories: MemoryFragment[]; failures: Record<string, unknown>[]; personaSource?: any };
const providerModels: Record<string, string> = { deepseek: 'deepseek-chat', openai: 'gpt-5-mini', qwen: 'qwen-plus', moonshot: 'moonshot-v1-32k', siliconflow: 'deepseek-ai/DeepSeek-V3' };
const statusText: Record<string, string> = { running: '运行中', completed: '已完成', partial: '部分完成', failed: '失败' };
const groupColor: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'purple' };

function fmtDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(new Date(value));
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function ActivityChart({ messages }: { messages: ChatMessage[] }) {
  const values = useMemo(() => {
    const map = new Map<string, number>();
    for (const message of messages) { const key = message.timestamp.slice(0, 10); map.set(key, (map.get(key) || 0) + 1); }
    if (!map.size) return [0, 0, 0, 0, 0, 0, 0];
    const keys = [...map.keys()].sort(); const start = new Date(`${keys[0]}T12:00:00Z`); const end = new Date(`${keys[keys.length - 1]}T12:00:00Z`); const result: number[] = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) result.push(map.get(cursor.toISOString().slice(0, 10)) || 0);
    return result;
  }, [messages]);
  const max = Math.max(...values, 1); const visible = values.slice(-42);
  return <div className="activity-chart" aria-label="每日消息活跃度">{visible.map((value, index) => <i key={index} className={index >= visible.length - 14 ? 'future-bar' : ''} style={{ height: `${Math.max(4, value / max * 100)}%` }} title={`${value} 条消息`} />)}</div>;
}

function trendLabel(messages: ChatMessage[]) {
  if (messages.length < 4) return '尚无趋势';
  const mid = Math.floor(messages.length / 2); const first = messages.slice(0, mid); const second = messages.slice(mid);
  const span = (items: ChatMessage[]) => Math.max(1, (new Date(items.at(-1)!.timestamp).getTime() - new Date(items[0].timestamp).getTime()) / 86400000 + 1);
  const ratio = (second.length / span(second)) / Math.max(.1, first.length / span(first));
  return ratio > 1.28 ? '活跃上升 ↗' : ratio < .72 ? '活跃回落 ↘' : '相对稳定 →';
}

export default function MemoryLab() {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<RunData | null>(null);
  const [detailTab, setDetailTab] = useState<'memory' | 'intent' | 'profile'>('memory');
  const [configOpen, setConfigOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [running, setRunning] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [config, setConfig] = useState({ name: `校园 32 人基础 Memory`, provider: 'deepseek', model: 'deepseek-chat', baseUrl: '', apiKey: '', historicalDays: 28, densityScale: 40, userCount: 32, concurrency: 2 });

  async function bootstrap(preferredRunId?: string) {
    const response = await fetch('/api/simulator'); const data = await response.json() as any;
    if (!response.ok) throw new Error(data.error || '加载失败');
    setPersonas(data.personas); setRuns(data.runs);
    const target = preferredRunId || data.runs?.[0]?.id;
    if (target) await loadRun(target);
  }

  async function loadRun(runId: string) {
    const response = await fetch(`/api/simulator?runId=${encodeURIComponent(runId)}`); const data = await response.json() as any;
    if (!response.ok) throw new Error(data.error || '读取实验失败'); setRunData(data);
  }

  useEffect(() => { bootstrap().catch((error) => setToast(error.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 5000); return () => clearTimeout(id); }, [toast]);

  const messagesByPersona = useMemo(() => { const map = new Map<string, ChatMessage[]>(); for (const message of runData?.messages ?? []) map.set(message.personaId, [...(map.get(message.personaId) || []), message]); return map; }, [runData]);
  const memoriesByPersona = useMemo(() => { const map = new Map<string, MemoryFragment[]>(); for (const item of runData?.memories ?? []) map.set(item.personaId, [...(map.get(item.personaId) || []), item]); return map; }, [runData]);
  const filtered = personas.filter((persona) => (filter === 'all' || (filter === 'HC' ? persona.hardCase : persona.activityClass === filter)) && `${persona.name}${persona.id}${persona.topic}${persona.education}`.toLowerCase().includes(query.toLowerCase()));
  const activePersona = personas.find((persona) => persona.id === selectedPersonaId) ?? null;
  const detailMessages = detailData?.messages ?? [];
  const detailMemories = detailData?.memories ?? [];

  async function openPersona(id: string) {
    setSelectedPersonaId(id); setDetailTab('memory'); setDetailData(null);
    try {
      const params = runData ? `runId=${runData.run.id}&personaId=${id}` : `personaId=${id}`;
      const response = await fetch(`/api/simulator?${params}`); const data = await response.json() as any; if (!response.ok) throw new Error(data.error); setDetailData(data);
    } catch (error) { setToast(error instanceof Error ? error.message : '读取用户失败'); }
  }

  async function startRun() {
    const ids = personas.map((p) => p.id);
    if (!config.apiKey) { setToast('请输入 API Key，或在发布环境配置对应环境变量'); return; }
    setConfigOpen(false); setRunning({ done: 0, total: ids.length, failed: 0 });
    try {
      const createResponse = await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_run', ...config, selectedIds: ids }) });
      const created = await createResponse.json() as any; if (!createResponse.ok) throw new Error(created.error);
      const queue = [...ids]; let done = 0; let failed = 0;
      async function worker() {
        while (queue.length) {
          const personaId = queue.shift(); if (!personaId) return;
          try {
            const response = await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-llm-api-key': config.apiKey }, body: JSON.stringify({ action: 'simulate_persona', runId: created.run.id, personaId, ...config }) });
            if (!response.ok) failed += 1;
          } catch { failed += 1; }
          done += 1; setRunning({ done, total: ids.length, failed });
        }
      }
      await Promise.all(Array.from({ length: Math.min(config.concurrency, ids.length) }, worker));
      await bootstrap(created.run.id); setToast(failed ? `实验完成：${done - failed} 人成功，${failed} 人失败；原因已写入历史实验` : `实验已完成，共 ${done} 人`);
    } catch (error) { setToast(error instanceof Error ? error.message : '实验启动失败'); }
    finally { setRunning(null); }
  }

  function exportRaw(personaId?: string) {
    if (!runData) return;
    const messages = personaId ? runData.messages.filter((m) => m.personaId === personaId) : runData.messages;
    downloadJson(`${runData.run.name}-${personaId || 'all'}-raw-chat.json`, { run: runData.run, exportedAt: new Date().toISOString(), users: personaId ? [personaId] : runData.selectedIds, messages });
  }
  function exportMemory(personaId?: string) {
    if (!runData) return;
    const fragments = (personaId ? runData.memories.filter((m) => m.personaId === personaId) : runData.memories);
    const daily = Object.groupBy(fragments, (item) => `${item.personaId}/${item.dayKey}`);
    downloadJson(`${runData.run.name}-${personaId || 'all'}-daily-memory.json`, { run: runData.run, exportedAt: new Date().toISOString(), cadence: 'daily', dailySnapshots: daily });
  }

  const messageCount = runData?.messages.length ?? 0; const memoryCount = runData?.memories.length ?? 0;

  return <main className="app-root">
    <header className="topbar">
      <button className="brand" onClick={() => setSelectedPersonaId(null)}><span className="brand-mark">M</span><span><strong>Memory Simulator</strong><small>用户记忆结构化实验室</small></span></button>
      <div className="header-actions"><button className="button ghost" onClick={() => setHistoryOpen(true)}>数据版本</button><button className="button secondary" disabled={!runData} onClick={() => exportMemory()}>↓ 全部 Memory</button><button className="button secondary future-action" disabled title="当前先完成既有 32 人数据集">＋ 导入新用户</button></div>
    </header>

    <div className="shell">
      <section className="hero"><div><p className="eyebrow">CAMPUS COHORT · 32 USERS</p><h1>既有 32 人的记忆生成档案</h1><p>每位用户和自己的固定守护者持续聊天。这里直接呈现过去对话与逐日 Memory，以及未来两周对话和 Memory，不需要重复发起实验。</p></div><div className="hero-actions">{!runData && <button className="button primary" onClick={() => setConfigOpen(true)}>初始化 32 人数据</button>}<button className="button secondary" disabled={!runData} onClick={() => exportRaw()}>↓ 全部原始对话</button></div></section>
      {runData && <div className="run-strip"><span className={`status ${runData.run.status}`}>{statusText[runData.run.status] || runData.run.status}</span><strong>{runData.run.name}</strong><small>{runData.run.provider} · {runData.run.model} · 密度 {runData.run.densityScale}%</small><span>{runData.run.completedCount}/{runData.run.selectedCount} 人完成</span>{runData.run.failedCount > 0 && <button onClick={() => setHistoryOpen(true)}>{runData.run.failedCount} 个失败原因 →</button>}</div>}
      <section className="metrics"><article><span>用户宇宙</span><strong>32</strong><small>20 自然用户 · 12 难例</small></article><article><span>已沉淀消息</span><strong>{messageCount.toLocaleString()}</strong><small>{runData ? '历史还原 + 未来模拟' : '运行实验后生成'}</small></article><article><span>每日 Memory</span><strong>{memoryCount.toLocaleString()}</strong><small>每条保留来源证据</small></article><article><span>时间窗</span><strong>{runData ? `${runData.run.historicalDays + 14} 天` : '42 天'}</strong><small>{runData ? `历史 ${runData.run.historicalDays} 天 · 未来 14 天` : '历史 28 天 · 未来 14 天'}</small></article></section>

      <section className="workspace">
        <div className="list-panel"><div className="section-head"><div><h2>用户与守护者</h2><p>{loading ? '正在读取用户宇宙…' : `${filtered.length} 位用户 · 点击查看对话与记忆来源`}</p></div><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索用户" /></label></div><div className="filters">{[['all','全部 32'],['A','A 高密度'],['B','B 稳定'],['C','C 事件驱动'],['D','D 低频'],['HC','Hard cases']].map(([key,label]) => <button key={key} className={`chip ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="user-list">
          {filtered.map((persona, index) => { const msgs = messagesByPersona.get(persona.id) ?? []; const mems = memoriesByPersona.get(persona.id) ?? []; return <button className="user-row" key={persona.id} onClick={() => openPersona(persona.id)}><span className={`avatar tone-${Number(persona.id.slice(1)) % 6}`}>{persona.name.slice(-1)}</span><span className="user-main"><span><strong>{persona.name}</strong><em>{persona.id}</em><b>{persona.agent.name}</b></span><small>{persona.education} · {persona.topic}</small></span><span className={`group-pill group-${groupColor[persona.activityClass]}`}>{persona.group.startsWith('HC') ? persona.group : `${persona.activityClass} · ${persona.activityLabel}`}</span><span className="trend-cell">{msgs.length ? <ActivityChart messages={msgs} /> : <span className="empty-line" />}<small>{trendLabel(msgs)}</small></span><span className="message-count"><strong>{msgs.length || '—'}</strong><small>{mems.length ? `${mems.length} 条记忆` : '未模拟'}</small></span><span className="chevron">›</span></button> })}
        </div></div>
        <aside className="side-panel"><div className="side-head"><span className="live-dot" /><div><h2>{runData ? '当前 Memory 健康度' : '基础数据尚未生成'}</h2><p>{runData ? `${runData.run.completedCount} 人已完成结构化沉淀` : '只需初始化一次，结果会共享保存'}</p></div></div><div className="quality-grid"><article><span>有来源</span><strong>{memoryCount ? Math.round(runData!.memories.filter((m) => m.sourceMessageIds.length).length / memoryCount * 100) : 0}%</strong></article><article><span>明确事实</span><strong>{runData?.memories.filter((m) => m.evidenceType === 'explicit').length ?? 0}</strong></article><article><span>待确认推断</span><strong>{runData?.memories.filter((m) => m.evidenceType === 'inferred').length ?? 0}</strong></article><article><span>Social Intent</span><strong>{runData?.memories.filter((m) => m.socialIntent).length ?? 0}</strong></article></div><div className="legend"><h3>这套固定数据会验证</h3><p><i className="legend-green" />记忆是否来自真实可定位的对话</p><p><i className="legend-blue" />短期状态是否与稳定特征分开</p><p><i className="legend-orange" />隐私与第三方信息是否被正确隔离</p><p><i className="legend-purple" />不同活跃类型是否产生不同密度</p></div>{!runData && <button className="open-detail" onClick={() => setConfigOpen(true)}>初始化既有 32 人 <span>→</span></button>}</aside>
      </section>
    </div>

    {selectedPersonaId && activePersona && <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedPersonaId(null); }}><section className="detail-drawer"><header className="drawer-head"><div className="detail-person"><span className={`avatar tone-${Number(activePersona.id.slice(1)) % 6}`}>{activePersona.name.slice(-1)}</span><div><h2>{activePersona.name} <span>× {activePersona.agent.name}</span></h2><p>{activePersona.group.startsWith('HC') ? activePersona.group : `${activePersona.activityClass} 类 · ${activePersona.activityLabel}`} · {trendLabel(detailMessages)}</p></div></div><div className="drawer-actions"><button onClick={() => exportRaw(activePersona.id)} disabled={!runData}>↓ 原始对话</button><button onClick={() => exportMemory(activePersona.id)} disabled={!runData}>↓ Memory</button><button className="close" onClick={() => setSelectedPersonaId(null)}>×</button></div></header><div className="detail-grid">
      <section className="chat-panel"><div className="chat-summary"><div><span>历史还原</span><strong>{detailMessages.filter((m) => m.phase === 'historical').length}</strong></div><div><span>未来两周</span><strong>{detailMessages.filter((m) => m.phase === 'future').length}</strong></div><div className="wide"><span>活跃变化</span><ActivityChart messages={detailMessages} /></div></div><div className="chat-scroll">{!detailData ? <div className="loading-card">正在读取完整记录…</div> : !detailMessages.length ? <div className="empty-state"><strong>还没有生成对话</strong><p>你可以在新建模拟中选择这个用户。原始人设不会直接当作已发生的聊天。</p></div> : <ConversationTimeline messages={detailMessages} userName={activePersona.name} agentName={activePersona.agent.name} />}</div></section>
      <aside className="memory-panel"><div className="profile-card"><div><span>用户简介</span><b>{activePersona.age} 岁 · {activePersona.city}</b></div><p>{activePersona.education}</p><div className="tag-row">{activePersona.interests.map((item) => <span key={item}>{item}</span>)}</div>{activePersona.hardCase && <p className="hard-note">测试点：{activePersona.hardCase}</p>}</div><div className="tabbar"><button className={detailTab === 'memory' ? 'active' : ''} onClick={() => setDetailTab('memory')}>记忆碎片</button><button className={detailTab === 'intent' ? 'active' : ''} onClick={() => setDetailTab('intent')}>Social Intent</button><button className={detailTab === 'profile' ? 'active' : ''} onClick={() => setDetailTab('profile')}>原始人设</button></div><div className="memory-scroll">{detailTab === 'profile' ? <pre className="profile-json">{JSON.stringify(detailData?.personaSource ?? {}, null, 2)}</pre> : <MemoryList fragments={detailTab === 'intent' ? detailMemories.filter((m) => m.socialIntent || m.domain === 'social_intent') : detailMemories} messages={detailMessages} />}
      </div></aside></div></section></div>}

    {configOpen && <div className="modal-backdrop"><section className="modal"><header><div><p className="eyebrow">ONE-TIME INITIALIZATION</p><h2>生成既有 32 人完整数据</h2></div><button onClick={() => setConfigOpen(false)}>×</button></header><div className="setup-note"><strong>一次生成，长期查看</strong><p>将为 32 位用户分别还原过去 28 天对话与每日 Memory，再模拟未来 14 天。完成后结果保存在共享数据库，其他访问者无需重新运行。</p></div><div className="form-grid"><label>API 提供商<select value={config.provider} onChange={(e) => setConfig({ ...config, provider: e.target.value, model: providerModels[e.target.value] })}>{Object.keys(providerModels).map((p) => <option key={p} value={p}>{p === 'qwen' ? '通义千问 Qwen' : p === 'moonshot' ? 'Moonshot / Kimi' : p === 'siliconflow' ? 'SiliconFlow' : p[0].toUpperCase()+p.slice(1)}</option>)}</select></label><label>模型<input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} /></label><label className="full">本次初始化 API Key<input type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="只存在当前浏览器内存，不保存、不共享" /><small>旧站输入过的 Key 无法取回，这是为了避免共享网址泄露密钥。也可使用服务端 {providerEnv(config.provider)}。</small></label><label className="full">自定义兼容地址（可选）<input value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder="留空使用官方 OpenAI-compatible 地址" /></label><label>对话密度<strong className="locked">40% 代表性采样</strong></label><label>并发数<select value={config.concurrency} onChange={(e) => setConfig({ ...config, concurrency: Number(e.target.value) })}><option value="1">1（最稳）</option><option value="2">2（推荐）</option><option value="3">3</option></select></label></div><footer><span>32 人 · 约 64 次模型调用</span><button className="button secondary" onClick={() => setConfigOpen(false)}>取消</button><button className="button primary" onClick={startRun}>开始一次性生成</button></footer></section></div>}

    {historyOpen && <div className="modal-backdrop"><section className="modal history-modal"><header><div><p className="eyebrow">SHARED RUNS</p><h2>历史实验</h2></div><button onClick={() => setHistoryOpen(false)}>×</button></header><div className="run-list">{!runs.length ? <div className="empty-state">还没有实验</div> : runs.map((run) => <button key={run.id} className={runData?.run.id === run.id ? 'selected' : ''} onClick={async () => { await loadRun(run.id); setHistoryOpen(false); }}><span className={`status ${run.status}`}>{statusText[run.status] || run.status}</span><span><strong>{run.name}</strong><small>{fmtDate(run.createdAt, true)} · {run.provider}/{run.model} · {run.densityScale}%</small>{run.errorSummary && <em>{run.errorSummary}</em>}</span><b>{run.completedCount}/{run.selectedCount}</b></button>)}</div></section></div>}
    {running && <div className="running-panel"><div><span className="spinner" /><strong>正在初始化 32 人固定数据</strong><small>{running.done}/{running.total} 位用户完成{running.failed ? ` · ${running.failed} 位失败` : ''}</small></div><div className="progress"><i style={{ width: `${running.done / running.total * 100}%` }} /></div><p>请保持本页打开。已完成的数据会立即写入共享数据库，失败原因也会保留。</p></div>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}

function providerEnv(provider: string) { return `${provider.toUpperCase()}_API_KEY`; }

function ConversationTimeline({ messages, userName, agentName }: { messages: ChatMessage[]; userName: string; agentName: string }) {
  let lastDay = ''; let lastPhase = '';
  return <>{messages.map((message) => { const day = message.timestamp.slice(0, 10); const newDay = day !== lastDay; const newPhase = message.phase !== lastPhase; lastDay = day; lastPhase = message.phase; return <div key={message.id}>{newPhase && <div className={`phase-divider ${message.phase}`}><span>{message.phase === 'historical' ? '历史还原' : '未来两周模拟'}</span></div>}{newDay && <div className="day-divider">{fmtDate(message.timestamp)}</div>}<article id={`message-${message.id}`} className={`bubble-row ${message.speaker}`}><span className="speaker-name">{message.speaker === 'user' ? userName : agentName}</span><div className="bubble">{message.content}</div><time>{fmtDate(message.timestamp, true).split(' ').at(-1)}</time></article></div>})}</>;
}

function MemoryList({ fragments, messages }: { fragments: MemoryFragment[]; messages: ChatMessage[] }) {
  function locate(ids: string[]) { const target = ids.find((id) => messages.some((m) => m.id === id)); if (target) { const node = document.getElementById(`message-${target}`); node?.scrollIntoView({ behavior: 'smooth', block: 'center' }); node?.classList.add('highlight'); setTimeout(() => node?.classList.remove('highlight'), 2200); } }
  if (!fragments.length) return <div className="empty-state"><strong>暂时没有可验证记忆</strong><p>这可能是对话尚未运行，或模型没有提供有效来源。</p></div>;
  const grouped = Object.groupBy(fragments, (item) => item.dayKey);
  return <>{Object.entries(grouped).sort(([a],[b]) => b.localeCompare(a)).map(([day, items]) => <section className="memory-day" key={day}><h3>{day} <span>每日总结</span></h3>{items!.map((item) => <button key={item.id} className="memory-card" onClick={() => locate(item.sourceMessageIds)}><span className={`memory-dot ${item.evidenceType}`} /><strong>{item.content}</strong><small>{item.domain} · {item.kind} · 置信度 {Math.round(item.confidence * 100)}%</small><footer><span className={item.privacy === 'normal' ? 'normal' : 'private'}>{item.privacy}</span><em>{item.sourceMessageIds.length} 条来源 →</em></footer></button>)}</section>)}</>;
}
