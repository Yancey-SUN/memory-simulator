'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage, MemoryFragment, PersonaSummary, PromptTemplate, RunRecord, SimulationTask } from '@/lib/types';

type RunData = { run: RunRecord; selectedIds: string[]; messages: ChatMessage[]; memories: MemoryFragment[]; failures: Record<string, unknown>[]; tasks?: SimulationTask[]; personaSource?: any };
const providerModels: Record<string, string> = { deepseek: 'deepseek-chat', openai: 'gpt-5-mini', qwen: 'qwen-plus', moonshot: 'moonshot-v1-32k', siliconflow: 'deepseek-ai/DeepSeek-V3', custom: '' };
const statusText: Record<string, string> = { running: '运行中', completed: '已完成', partial: '部分完成', failed: '失败' };
const groupColor: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'purple' };

function fmtDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(new Date(value));
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function ActivityChart({ messages, compact = false }: { messages: ChatMessage[]; compact?: boolean }) {
  const [hovered, setHovered] = useState<{ date: string; value: number } | null>(null);
  const points = useMemo(() => {
    const map = new Map<string, number>();
    for (const message of messages) { const key = message.timestamp.slice(0, 10); map.set(key, (map.get(key) || 0) + 1); }
    if (!map.size) return Array.from({length:7}, (_, index) => ({ date: `—${index}`, value: 0 }));
    const keys = [...map.keys()].sort(); const start = new Date(`${keys[0]}T12:00:00Z`); const end = new Date(`${keys[keys.length - 1]}T12:00:00Z`); const result: Array<{date:string;value:number}> = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) { const date = cursor.toISOString().slice(0, 10); result.push({ date, value: map.get(date) || 0 }); }
    return result;
  }, [messages]);
  const visible = points.slice(-42); const max = Math.max(...visible.map((point) => point.value), 1);
  return <div className={`activity-wrap ${compact ? 'compact' : ''}`}><div className="activity-chart" aria-label="每日消息活跃度">{visible.map((point, index) => <i key={point.date} className={index >= visible.length - 14 ? 'future-bar' : ''} style={{ height: `${Math.max(4, point.value / max * 100)}%` }} onMouseEnter={() => setHovered(point)} onMouseLeave={() => setHovered(null)} />)}</div>{!compact && hovered && <div className="activity-tooltip">{hovered.date} · {hovered.value} 条消息</div>}{!compact && visible.length > 1 && <div className="activity-axis"><span>{visible[0].date.slice(5)}</span><span>{visible.at(-1)!.date.slice(5)}</span></div>}</div>;
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
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<RunData | null>(null);
  const [detailTab, setDetailTab] = useState<'memory' | 'intent' | 'compare'>('memory');
  const [configOpen, setConfigOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editRun, setEditRun] = useState<{ id: string; name: string; notes: string } | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [running, setRunning] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [config, setConfig] = useState({ name: `模型对话实验`, provider: 'deepseek', customProviderName: '', model: 'deepseek-chat', baseUrl: '', apiKey: '', historicalDays: 28, densityScale: 50, userCount: 32, concurrency: 2, promptTemplateId: '', promptName: '', userPrompt: '', agentPrompt: '', guardianSpec: '' });
  const [promptDraft, setPromptDraft] = useState({ id: '', name: '', userPrompt: '', agentPrompt: '', guardianSpec: '' });

  async function bootstrap(preferredRunId?: string) {
    const response = await fetch('/api/simulator'); const data = await response.json() as any;
    if (!response.ok) throw new Error(data.error || '加载失败');
    setPersonas(data.personas); setRuns(data.runs); setPromptTemplates(data.promptTemplates || []);
    if (!config.promptTemplateId && data.promptTemplates?.[0]) {
      const prompt = data.promptTemplates[0] as PromptTemplate;
      setConfig((current) => ({ ...current, promptTemplateId: prompt.id, promptName: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec }));
      setPromptDraft({ id: prompt.id, name: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec });
    }
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

  async function runTasks(runId: string, ids: string[], providerOverride?: string, modelOverride?: string) {
    const queue = [...ids]; let done = 0; let failed = 0;
    setRunning({ done: 0, total: ids.length, failed: 0 });
    async function worker() {
      while (queue.length) {
        const personaId = queue.shift(); if (!personaId) return;
        let personaFailed = false;
        for (;;) {
          try {
            const response = await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-llm-api-key': config.apiKey }, body: JSON.stringify({ action: 'simulate_step', runId, personaId, provider: providerOverride || config.provider, model: modelOverride || config.model, baseUrl: config.baseUrl }) });
            const result = await response.json() as any;
            if (!response.ok && !result.retryable) { personaFailed = true; break; }
            if (!response.ok && result.retryable) continue;
            if (result.done) break;
          } catch { personaFailed = true; break; }
        }
        if (personaFailed) failed += 1;
        done += 1; setRunning({ done, total: ids.length, failed });
      }
    }
    await Promise.all(Array.from({ length: Math.min(config.concurrency, ids.length) }, worker));
    return { done, failed };
  }

  async function startRun() {
    const ids = personas.slice(0, Math.max(1, Math.min(config.userCount, personas.length))).map((p) => p.id);
    if (!config.apiKey) { setToast('请输入 API Key，或在发布环境配置对应环境变量'); return; }
    if (config.provider === 'custom' && !config.customProviderName.trim()) { setToast('请填写自定义 API 厂商名称'); return; }
    if (config.provider === 'custom' && !config.baseUrl.trim()) { setToast('请填写自定义厂商的 Base URL'); return; }
    if (!config.model.trim()) { setToast('请填写模型名称'); return; }
    setConfigOpen(false);
    try {
      const createResponse = await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_run', ...config, selectedIds: ids }) });
      const created = await createResponse.json() as any; if (!createResponse.ok) throw new Error(created.error);
      const { done, failed } = await runTasks(created.run.id, ids);
      await bootstrap(created.run.id); setToast(failed ? `本次推进完成：${done - failed} 人完成，${failed} 人停止；已完成会话均已保存` : `实验已完成，共 ${done} 人`);
    } catch (error) { setToast(error instanceof Error ? error.message : '实验启动失败'); }
    finally { setRunning(null); }
  }

  async function resumeRun(run: RunRecord) {
    if (!config.apiKey) { setToast('继续实验前请先在“模型对比实验”中输入 API Key'); setConfigOpen(true); return; }
    const knownProvider = Object.hasOwn(providerModels, run.provider) ? run.provider : 'custom';
    if (knownProvider === 'custom' && !config.baseUrl.trim()) { setToast('继续自定义厂商实验前，需要重新填写原 Base URL；Key 和地址都不会被服务器保存'); setConfigOpen(true); return; }
    if (run.status === 'partial' || run.status === 'failed') {
      await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_failed_tasks', runId: run.id }) });
    }
    const response = await fetch(`/api/simulator?runId=${encodeURIComponent(run.id)}`);
    const data = await response.json() as RunData & { error?: string };
    if (!response.ok) { setToast(data.error || '读取实验失败'); return; }
    const pending = (data.tasks || []).filter((task) => task.status === 'pending' || task.status === 'running').map((task) => task.personaId);
    if (!pending.length) { setToast('这个实验没有可继续的任务'); return; }
    setHistoryOpen(false);
    try {
      const { done, failed } = await runTasks(run.id, pending, knownProvider, run.model);
      await bootstrap(run.id);
      setToast(failed ? `已续跑 ${done} 位用户，其中 ${failed} 位仍失败` : `已从断点继续完成 ${done} 位用户`);
    } finally { setRunning(null); }
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

  async function saveExperimentEdit() {
    if (!editRun?.name.trim()) { setToast('实验名称不能为空'); return; }
    const response = await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_run', runId: editRun.id, name: editRun.name.trim(), notes: editRun.notes.trim() }) });
    const result = await response.json() as any;
    if (!response.ok) { setToast(result.error || '修改失败'); return; }
    const currentId = runData?.run.id;
    setEditRun(null); await bootstrap(currentId); setToast('实验信息已更新');
  }

  async function deleteExperiment(run: RunRecord) {
    if (!window.confirm(`确定删除“${run.name}”吗？\n\n该实验的对话、Memory 和失败记录都会永久删除。`)) return;
    const response = await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_run', runId: run.id }) });
    const result = await response.json() as any;
    if (!response.ok) { setToast(result.error || '删除失败'); return; }
    const selectedDeleted = runData?.run.id === run.id;
    await bootstrap(selectedDeleted ? undefined : runData?.run.id);
    setToast('实验已删除');
  }

  function selectPrompt(id: string) {
    const prompt = promptTemplates.find((item) => item.id === id);
    if (!prompt) return;
    setConfig((current) => ({ ...current, promptTemplateId: prompt.id, promptName: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec }));
    setPromptDraft({ id: prompt.id, name: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec });
  }

  function editCurrentPrompt() {
    const runPrompt = runData?.run;
    if (runPrompt?.userPrompt && runPrompt?.agentPrompt) {
      setPromptDraft({ id: runPrompt.promptTemplateId || '', name: runPrompt.promptName || `${runPrompt.name} Prompt`, userPrompt: runPrompt.userPrompt, agentPrompt: runPrompt.agentPrompt, guardianSpec: runPrompt.guardianSpec || '' });
      setPromptOpen(true); return;
    }
    const prompt = promptTemplates.find((item) => item.id === runPrompt?.promptTemplateId) || promptTemplates.find((item) => item.id === config.promptTemplateId) || promptTemplates[0];
    if (prompt) setPromptDraft({ id: prompt.id, name: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec });
    setPromptOpen(true);
  }

  async function savePrompt(asNew: boolean) {
    const response = await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_prompt', ...promptDraft, id: asNew ? undefined : promptDraft.id }) });
    const result = await response.json() as { prompt?: PromptTemplate; error?: string };
    if (!response.ok || !result.prompt) { setToast(result.error || '保存 Prompt 失败'); return; }
    const prompt = result.prompt;
    if (runData?.run.id && !['campus-32-baseline-v1', 'guardian-human-v1'].includes(runData.run.id)) {
      await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_run_prompt', runId: runData.run.id, promptTemplateId: prompt.id, promptName: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec }) });
    }
    setPromptTemplates((items) => [prompt, ...items.filter((item) => item.id !== prompt.id)]);
    setPromptDraft({ id: prompt.id, name: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec });
    setConfig((current) => ({ ...current, promptTemplateId: prompt.id, promptName: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec }));
    setRunData((current) => current && !['campus-32-baseline-v1', 'guardian-human-v1'].includes(current.run.id) && current.run.promptTemplateId === prompt.id ? { ...current, run: { ...current.run, promptName: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec } } : current);
    setToast(asNew ? '已保存为新的共享 Prompt' : 'Prompt 已更新；新建 API 实验时生效');
  }

  const messageCount = runData?.messages.length ?? 0; const memoryCount = runData?.memories.length ?? 0;
  const dailyMemoryCount = new Set((runData?.memories ?? []).map((item) => `${item.personaId}/${item.dayKey}`)).size;

  return <main className="app-root">
    <header className="topbar">
      <button className="brand" onClick={() => setSelectedPersonaId(null)}><span className="brand-mark">M</span><span><strong>Memory Simulator</strong><small>用户记忆结构化实验室</small></span></button>
      <div className="header-actions"><button className="button ghost" onClick={() => setHistoryOpen(true)}>实验版本</button><button className="button ghost" onClick={editCurrentPrompt}>Prompt 库</button><button className="button secondary" disabled={!runData} onClick={() => exportMemory()}>↓ 全部 Memory</button><button className="button primary" onClick={() => setConfigOpen(true)}>＋ 模型对比实验</button></div>
    </header>

    <div className="shell">
      <section className="hero"><div><p className="eyebrow">VOUCH NATURAL MEMORY · 32 USERS</p><h1>从连续聊天，沉淀可验证的 Memory</h1><p>当前默认展示优化后的 Vouch 自然对话基线。用户先聊具体的人和事，系统再按天总结并写入对应 Memory 框架；也可以创建模型实验进行版本对比。</p></div><div className="hero-actions"><button className="button primary" onClick={() => setConfigOpen(true)}>创建模型实验</button><button className="button secondary" disabled={!runData} onClick={() => exportRaw()}>↓ 全部原始对话</button></div></section>
      {runData && <div className="run-strip"><span className={`status ${runData.run.status}`}>{statusText[runData.run.status] || runData.run.status}</span><strong>{runData.run.name}</strong><small>{runData.run.provider} · {runData.run.model} · {runData.run.promptName || '默认 Prompt'} · 密度 {runData.run.densityScale}%</small><button onClick={editCurrentPrompt}>编辑 Prompt</button><span>{runData.run.completedCount}/{runData.run.selectedCount} 人完成</span>{runData.run.failedCount > 0 && <button onClick={() => setHistoryOpen(true)}>{runData.run.failedCount} 个失败原因 →</button>}</div>}
      <section className="metrics"><article><span>用户宇宙</span><strong>32</strong><small>20 自然用户 · 12 难例</small></article><article><span>已沉淀消息</span><strong>{messageCount.toLocaleString()}</strong><small>{runData ? '历史还原 + 未来模拟' : '运行实验后生成'}</small></article><article><span>每日 Memory</span><strong>{dailyMemoryCount.toLocaleString()}</strong><small>{memoryCount} 条结构化更新，均保留来源</small></article><article><span>时间窗</span><strong>{runData ? `${runData.run.historicalDays + 14} 天` : '42 天'}</strong><small>{runData ? `历史 ${runData.run.historicalDays} 天 · 未来 14 天` : '历史 28 天 · 未来 14 天'}</small></article></section>

      <section className="workspace">
        <div className="list-panel"><div className="section-head"><div><h2>用户与守护者</h2><p>{loading ? '正在读取用户宇宙…' : `${filtered.length} 位用户 · 点击查看对话与记忆来源`}</p></div><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索用户" /></label></div><div className="filters">{[['all','全部 32'],['A','A 高密度'],['B','B 稳定'],['C','C 事件驱动'],['D','D 低频'],['HC','Hard cases']].map(([key,label]) => <button key={key} className={`chip ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="user-list">
          {filtered.map((persona) => { const msgs = messagesByPersona.get(persona.id) ?? []; const mems = memoriesByPersona.get(persona.id) ?? []; return <button className="user-row" key={persona.id} onClick={() => openPersona(persona.id)}><span className={`avatar tone-${Number(persona.id.slice(1)) % 6}`}>{persona.name.slice(-1)}</span><span className="user-main"><span><strong>{persona.name}</strong><em>{persona.id}</em><b>{persona.agent.archetype || 'Agent'}</b></span><small>{persona.education} · {persona.topic}</small></span><span className={`group-pill group-${groupColor[persona.activityClass]}`}>{persona.group.startsWith('HC') ? persona.group : `${persona.activityClass} · ${persona.activityLabel}`}</span><span className="trend-cell">{msgs.length ? <ActivityChart messages={msgs} compact /> : <span className="empty-line" />}<small>{trendLabel(msgs)}</small></span><span className="message-count"><strong>{msgs.length || '—'}</strong><small>{msgs.length ? `条消息 · ${mems.length} 条更新` : '未模拟'}</small></span><span className="chevron">›</span></button> })}
        </div></div>
        <aside className="side-panel"><div className="side-head"><span className="live-dot" /><div><h2>当前版本 Memory 健康度</h2><p>{runData ? `${runData.run.completedCount} 人已完成结构化沉淀` : '正在读取版本'}</p></div></div><div className="quality-grid"><article><span>有来源</span><strong>{memoryCount ? Math.round(runData!.memories.filter((m) => m.sourceMessageIds.length).length / memoryCount * 100) : 0}%</strong></article><article><span>明确事实</span><strong>{runData?.memories.filter((m) => m.evidenceType === 'explicit').length ?? 0}</strong></article><article><span>观察 / 推断</span><strong>{runData?.memories.filter((m) => m.evidenceType !== 'explicit').length ?? 0}</strong></article><article><span>Social Intent</span><strong>{runData?.memories.filter((m) => m.socialIntent).length ?? 0}</strong></article></div><div className="legend"><h3>当前 Vouch Prompt 重点</h3><p><i className="legend-green" />从具体事件开场，不让用户念画像摘要</p><p><i className="legend-blue" />Agent 接住明确对象并延续上下文</p><p><i className="legend-orange" />每天先汇总，再写入 Memory 框架</p><p><i className="legend-purple" />未来新增 Memory 与原始 Memory 对照</p></div><button className="open-detail" onClick={() => setConfigOpen(true)}>用其他模型创建实验 <span>→</span></button></aside>
      </section>
    </div>

    {selectedPersonaId && activePersona && <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedPersonaId(null); }}><section className="detail-drawer"><header className="drawer-head"><div className="detail-person"><span className={`avatar tone-${Number(activePersona.id.slice(1)) % 6}`}>{activePersona.name.slice(-1)}</span><div><h2>{activePersona.name} <span>× Agent</span></h2><p>{activePersona.group.startsWith('HC') ? activePersona.group : `${activePersona.activityClass} 类 · ${activePersona.activityLabel}`} · {trendLabel(detailMessages)}</p></div></div><div className="drawer-actions"><button onClick={() => exportRaw(activePersona.id)} disabled={!runData}>↓ 原始对话</button><button onClick={() => exportMemory(activePersona.id)} disabled={!runData}>↓ Memory</button><button className="close" onClick={() => setSelectedPersonaId(null)}>×</button></div></header><div className="detail-grid">
      <section className="chat-panel"><div className="chat-summary"><div><span>历史还原</span><strong>{detailMessages.filter((m) => m.phase === 'historical').length}</strong></div><div><span>未来两周</span><strong>{detailMessages.filter((m) => m.phase === 'future').length}</strong></div><div className="wide"><span>活跃变化</span><ActivityChart messages={detailMessages} /></div></div><div className="chat-scroll">{!detailData ? <div className="loading-card">正在读取完整记录…</div> : !detailMessages.length ? <div className="empty-state"><strong>还没有生成对话</strong><p>你可以创建模型实验来生成这个用户的聊天；隐藏资料不会直接作为台词。</p></div> : <ConversationTimeline messages={detailMessages} userName={activePersona.name} agentName="Agent" />}</div></section>
      <aside className="memory-panel"><div className="profile-card"><div><span>用户简介</span><b>{activePersona.age} 岁 · {activePersona.city}</b></div><p>{activePersona.education}</p><div className="bazi-fact"><span>命理信息</span><strong>日主 {activePersona.agent.dayMaster}</strong><small>{elementLabel(activePersona.agent.element)} · {activePersona.agent.yinYang === 'yang' ? '阳' : '阴'}</small></div><div className="tag-row">{activePersona.interests.map((item) => <span key={item}>{item}</span>)}</div>{activePersona.hardCase && <p className="hard-note">测试点：{activePersona.hardCase}</p>}<div className="guardian-card"><div><span>个性化伴生精灵</span><b>{activePersona.agent.archetype} · {activePersona.agent.dayMaster}</b></div><p>{activePersona.agent.voice}</p><small><strong>同频</strong> {activePersona.agent.resonance?.join(' · ')}</small><small><strong>调节</strong> {activePersona.agent.regulation?.join(' · ')}</small></div></div><div className="tabbar"><button className={detailTab === 'memory' ? 'active' : ''} onClick={() => setDetailTab('memory')}>每日 Memory</button><button className={detailTab === 'intent' ? 'active' : ''} onClick={() => setDetailTab('intent')}>Social Intent</button><button className={detailTab === 'compare' ? 'active' : ''} onClick={() => setDetailTab('compare')}>Memory 对照</button></div><div className="memory-scroll">{detailTab === 'compare' ? <MemoryComparison source={detailData?.personaSource} fragments={detailMemories} messages={detailMessages} /> : <MemoryList fragments={detailTab === 'intent' ? detailMemories.filter((m) => m.socialIntent || m.domain === 'social_intent') : detailMemories} messages={detailMessages} onShowCurrent={(id) => { setDetailTab('compare'); setTimeout(() => document.getElementById(`current-memory-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} />}
      </div></aside></div></section></div>}

    {configOpen && <div className="modal-backdrop"><section className="modal"><header><div><p className="eyebrow">MODEL EXPERIMENT</p><h2>创建模型对话实验</h2></div><button onClick={() => setConfigOpen(false)}>×</button></header><div className="setup-note"><strong>双角色逐轮 Simulation</strong><p>用户模型与守护者模型会独立交替回复；每段会话立即保存，Memory 在会话后单独抽取。API Key 只随当前请求发送，不保存。</p></div><div className="form-grid"><label className="full">实验名称<input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} /></label><label className="full prompt-picker">人设 Prompt<select value={config.promptTemplateId} onChange={(e) => selectPrompt(e.target.value)}>{promptTemplates.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name}</option>)}</select><button type="button" onClick={() => { setConfigOpen(false); editCurrentPrompt(); }}>编辑 / 新建 Prompt</button></label><label>API 提供商<select value={config.provider} onChange={(e) => { const provider = e.target.value; setConfig({ ...config, provider, model: providerModels[provider], baseUrl: provider === 'custom' ? config.baseUrl : '' }); }}>{Object.keys(providerModels).map((p) => <option key={p} value={p}>{p === 'qwen' ? '通义千问 Qwen' : p === 'moonshot' ? 'Moonshot / Kimi' : p === 'siliconflow' ? 'SiliconFlow' : p === 'custom' ? '其他厂商（OpenAI-compatible）' : p[0].toUpperCase()+p.slice(1)}</option>)}</select></label><label>模型名称<input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} placeholder={config.provider === 'custom' ? '例如 vendor-model-name' : ''} /></label>{config.provider === 'custom' && <label className="full">厂商名称<input value={config.customProviderName} onChange={(e) => setConfig({ ...config, customProviderName: e.target.value })} placeholder="用于实验记录，例如 MiniMax" /></label>}<label className="full">API Key<input type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="只存在当前页面内存，不保存、不共享" /><small>{config.provider === 'custom' ? '未知厂商的 Key 也不会写入实验记录。' : `也可在服务端配置 ${providerEnv(config.provider)} 或通用 LLM_API_KEY。`}</small></label><label className="full">OpenAI-compatible Base URL{config.provider === 'custom' ? '（必填）' : '（可选）'}<input value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder={config.provider === 'custom' ? 'https://api.vendor.com/v1' : '留空使用对应厂商官方地址'} /><small>自定义厂商需支持 /chat/completions 接口和 Bearer Key。</small></label><label>用户人数 <b>{config.userCount}</b><input type="range" min="1" max="32" value={config.userCount} onChange={(e) => setConfig({ ...config, userCount: Number(e.target.value) })} /></label><label>并发数<select value={config.concurrency} onChange={(e) => setConfig({ ...config, concurrency: Number(e.target.value) })}><option value="1">1（最稳）</option><option value="2">2（推荐）</option><option value="3">3</option></select></label><label>历史回溯天数<input type="number" min="7" max="90" value={config.historicalDays} onChange={(e) => setConfig({ ...config, historicalDays: Number(e.target.value) })} /></label><label>未来模拟<strong className="locked">固定 14 天</strong></label><label className="full">对话密度 <b>{config.densityScale}%</b><input type="range" min="10" max="100" step="10" value={config.densityScale} onChange={(e) => setConfig({ ...config, densityScale: Number(e.target.value) })} /></label></div><footer><span>密度越高，会话数和真实逐轮 API 调用次数越多</span><button className="button secondary" onClick={() => setConfigOpen(false)}>取消</button><button className="button primary" onClick={startRun}>创建并运行</button></footer></section></div>}

    {promptOpen && <div className="modal-backdrop"><section className="modal prompt-modal"><header><div><p className="eyebrow">SHARED PROMPT LIBRARY</p><h2>用户 / Agent / 人格规则库</h2></div><button onClick={() => setPromptOpen(false)}>×</button></header><div className="setup-note"><strong>可以直接编辑 Markdown 后重新实验</strong><p>保存后，所有访问者都能在新实验中调用；已生成实验保留当时快照。修改规则不会悄悄改写旧对话，需要创建一次新实验来重新生成。</p></div><div className="prompt-editor"><aside>{promptTemplates.map((prompt) => <button key={prompt.id} className={promptDraft.id === prompt.id ? 'active' : ''} onClick={() => setPromptDraft({ id: prompt.id, name: prompt.name, userPrompt: prompt.userPrompt, agentPrompt: prompt.agentPrompt, guardianSpec: prompt.guardianSpec })}><strong>{prompt.name}</strong><small>{prompt.builtin ? '内置版本 · 可编辑副本' : `更新于 ${fmtDate(prompt.updatedAt, true)}`}</small></button>)}<button className="new-prompt" onClick={() => setPromptDraft({ id: '', name: '新的 Prompt', userPrompt: promptDraft.userPrompt, agentPrompt: promptDraft.agentPrompt, guardianSpec: promptDraft.guardianSpec })}>＋ 基于当前新建</button></aside><div className="prompt-fields"><label>Prompt 名称<input value={promptDraft.name} onChange={(e) => setPromptDraft({ ...promptDraft, name: e.target.value })} /></label><label>用户人设 Prompt<textarea value={promptDraft.userPrompt} onChange={(e) => setPromptDraft({ ...promptDraft, userPrompt: e.target.value })} /><small>支持 {'{{USER_PROFILE}}'}、{'{{CURRENT_LIFE_STATE}}'}、{'{{SCENE}}'}、{'{{ACTIVITY_BASELINE}}'} 占位符。</small></label><label>Agent 人设 Prompt<textarea value={promptDraft.agentPrompt} onChange={(e) => setPromptDraft({ ...promptDraft, agentPrompt: e.target.value })} /><small>支持 {'{{GUARDIAN_PROFILE}}'} 与 {'{{GUARDIAN_RULES}}'}。</small></label><label>人格规则 Markdown<textarea className="markdown-editor" value={promptDraft.guardianSpec} onChange={(e) => setPromptDraft({ ...promptDraft, guardianSpec: e.target.value })} /><small>可粘贴类似“伴生精灵人感优化”的 Markdown；保存后选择此版本创建实验即可重新生成。</small></label></div></div><footer><span>修改只影响以后重新生成的实验</span><button className="button secondary" onClick={() => savePrompt(true)}>另存为新版本</button><button className="button primary" onClick={() => savePrompt(false)}>{promptDraft.id ? '保存修改' : '保存到库'}</button></footer></section></div>}

    {historyOpen && <div className="modal-backdrop"><section className="modal history-modal"><header><div><p className="eyebrow">EXPERIMENT VERSIONS</p><h2>切换与管理实验</h2></div><button onClick={() => setHistoryOpen(false)}>×</button></header><div className="run-list">{runs.map((run) => { const editable = !['campus-32-baseline-v1', 'guardian-human-v1'].includes(run.id); return <div key={run.id} className={`run-item ${runData?.run.id === run.id ? 'selected' : ''}`}><button className="run-select" onClick={async () => { await loadRun(run.id); setHistoryOpen(false); }}><span className={`status ${run.status}`}>{statusText[run.status] || run.status}</span><span><strong>{run.name}</strong><small>{fmtDate(run.createdAt, true)} · {run.provider}/{run.model} · {run.densityScale}%</small>{run.notes && <i>{run.notes}</i>}{run.errorSummary && <em>{run.errorSummary}</em>}</span><b>{run.completedCount}/{run.selectedCount}</b></button>{editable && <div className="run-actions">{['running','partial','failed'].includes(run.status) && <button onClick={() => resumeRun(run)}>{run.status === 'running' ? '继续运行' : '修复后重试'}</button>}<button onClick={() => { setEditRun({ id: run.id, name: run.name, notes: run.notes || '' }); setHistoryOpen(false); }}>修改</button><button className="delete-run" onClick={() => deleteExperiment(run)}>删除</button></div>}</div>; })}</div></section></div>}
    {editRun && <div className="modal-backdrop"><section className="modal edit-run-modal"><header><div><p className="eyebrow">EDIT EXPERIMENT</p><h2>修改实验信息</h2></div><button onClick={() => setEditRun(null)}>×</button></header><div className="setup-note"><strong>保留实验可追溯性</strong><p>可修改名称和备注。已生成的模型、Prompt、对话和 Memory 快照不会被改写。</p></div><div className="form-grid"><label className="full">实验名称<input value={editRun.name} onChange={(e) => setEditRun({ ...editRun, name: e.target.value })} maxLength={80} /></label><label className="full">实验备注<textarea value={editRun.notes} onChange={(e) => setEditRun({ ...editRun, notes: e.target.value })} maxLength={1000} placeholder="例如：用于比较更短回复与更高玩心的效果" /></label></div><footer><button className="button secondary" onClick={() => setEditRun(null)}>取消</button><button className="button primary" onClick={saveExperimentEdit}>保存修改</button></footer></section></div>}
    {running && <div className="running-panel"><div><span className="spinner" /><strong>正在进行双角色逐轮模拟</strong><small>{running.done}/{running.total} 位用户完成{running.failed ? ` · ${running.failed} 位停止` : ''}</small></div><div className="progress"><i style={{ width: `${running.done / running.total * 100}%` }} /></div><p>可以中断：已完成的每段会话都已保存，之后重新输入 Key 可从历史实验继续。</p></div>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}

function elementLabel(element?: string) {
  return ({ wood: '木', fire: '火', earth: '土', metal: '金', water: '水' } as Record<string, string>)[element || ''] || '未知五行';
}

function providerEnv(provider: string) { return `${provider.toUpperCase()}_API_KEY`; }

function ConversationTimeline({ messages, userName, agentName }: { messages: ChatMessage[]; userName: string; agentName: string }) {
  let lastDay = ''; let lastPhase = '';
  return <>{messages.map((message) => { const day = message.timestamp.slice(0, 10); const newDay = day !== lastDay; const newPhase = message.phase !== lastPhase; lastDay = day; lastPhase = message.phase; return <div key={message.id}>{newPhase && <div className={`phase-divider ${message.phase}`}><span>{message.phase === 'historical' ? '历史还原' : '未来两周模拟'}</span></div>}{newDay && <div className="day-divider">{fmtDate(message.timestamp)}</div>}<article id={`message-${message.id}`} className={`bubble-row ${message.speaker}`}><span className="speaker-name">{message.speaker === 'user' ? userName : agentName}</span><div className="bubble">{message.content}</div><time>{fmtDate(message.timestamp, true).split(' ').at(-1)}</time></article></div>})}</>;
}

function locateMessage(ids: string[], messages: ChatMessage[]) {
  const target = ids.find((id) => messages.some((message) => message.id === id));
  if (!target) return;
  const node = document.getElementById(`message-${target}`);
  node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node?.classList.add('highlight');
  setTimeout(() => node?.classList.remove('highlight'), 2200);
}

function MemoryList({ fragments, messages, onShowCurrent }: { fragments: MemoryFragment[]; messages: ChatMessage[]; onShowCurrent?: (id: string) => void }) {
  if (!fragments.length) return <div className="empty-state"><strong>暂时没有可验证记忆</strong><p>这可能是对话尚未运行，或模型没有提供有效来源。</p></div>;
  const grouped = Object.groupBy(fragments, (item) => item.dayKey);
  return <>{Object.entries(grouped).sort(([a],[b]) => b.localeCompare(a)).map(([day, rawItems]) => {
    const items = rawItems!;
    const summary = items.find((item) => item.dailySummary)?.dailySummary || items.map((item) => item.content).join('；');
    const paths = [...new Set(items.map((item) => item.frameworkPath || item.domain))];
    return <section className="daily-memory" key={day}><header><div><h3>{day}</h3><span>{items[0].phase === 'future' ? '未来模拟' : '历史还原'}</span></div><p>{summary}</p><div className="framework-paths"><b>沉淀到</b>{paths.map((path) => <span key={path}>{path}</span>)}</div></header><div className="memory-updates">{items.map((item) => <article key={item.id} className="memory-update"><span className={`memory-dot ${item.evidenceType}`} /><div><strong>{item.content}</strong><small>{item.kind} · 置信度 {Math.round(item.confidence * 100)}% · {item.privacy}</small></div><footer><button onClick={() => locateMessage(item.sourceMessageIds, messages)}>{item.sourceMessageIds.length} 条来源</button>{onShowCurrent && <button onClick={() => onShowCurrent(item.id)}>当前 Memory</button>}</footer></article>)}</div></section>;
  })}</>;
}

type FlatMemory = { path: string; content: string };

function flattenOriginalMemory(source: any): FlatMemory[] {
  const rows: FlatMemory[] = [];
  function walk(value: any, path: string) {
    if (value == null || rows.length >= 80) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (String(value).trim()) rows.push({ path, content: String(value) });
      return;
    }
    if (Array.isArray(value)) { value.slice(0, 8).forEach((item, index) => walk(item, `${path}[${index}]`)); return; }
    if (typeof value === 'object' && typeof value.content === 'string') {
      rows.push({ path, content: value.content }); return;
    }
    if (typeof value === 'object' && Array.isArray(value.content)) {
      value.content.slice(0, 8).forEach((item: any) => walk(item, path)); return;
    }
    if (typeof value === 'object') Object.entries(value).forEach(([key, child]) => {
      if (!['confidence', 'source', 'updated_at', 'created_at', 'evidence_type'].includes(key)) walk(child, path ? `${path}.${key}` : key);
    });
  }
  walk(source?.['01_Self_Memory'], '01_Self_Memory');
  walk(source?.['05_Matching_Profile']?.Social_Intent, '05_Matching_Profile.Social_Intent');
  return rows;
}

function MemoryComparison({ source, fragments, messages }: { source: any; fragments: MemoryFragment[]; messages: ChatMessage[] }) {
  const original = flattenOriginalMemory(source);
  const future = fragments.filter((item) => item.phase === 'future');
  return <div className="memory-compare"><section><header><span>输入基线</span><h3>原始 Memory</h3><p>模拟开始前已有的结构化信息</p></header><div className="compare-list">{original.length ? original.map((item, index) => <article key={`${item.path}-${index}`}><small>{item.path}</small><p>{item.content}</p></article>) : <div className="empty-state">没有原始 Memory</div>}</div></section><section className="current-column"><header><span>两周后</span><h3>当前 Memory</h3><p>原始 Memory + 对话中新沉淀的内容</p></header><div className="compare-list">{original.map((item, index) => <article key={`current-${item.path}-${index}`}><small>{item.path}</small><p>{item.content}</p></article>)}{future.map((item) => <article id={`current-memory-${item.id}`} key={item.id} className="new-memory"><div className="new-label">未来新增</div><small>{item.frameworkPath || item.domain}</small><p>{item.content}</p><button onClick={() => locateMessage(item.sourceMessageIds, messages)}>回到来源对话 →</button></article>)}{!original.length && !future.length && <div className="empty-state">暂时没有当前 Memory</div>}</div></section></div>;
}
