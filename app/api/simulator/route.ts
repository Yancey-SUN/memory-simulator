import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { activityPlan, buildProfileForPrompt, getPersonaSource, getPersonaSummaries } from '@/lib/personas';
import { buildGuardianTurnPrompt, buildMemoryExtractionPrompt, buildUserTurnPrompt } from '@/lib/prompts';
import { appendSessionResult, createRun, deleteRun, getRunData, getSimulationTask, initializeRunTasks, listPromptTemplates, listRuns, recordTaskError, resetFailedTasks, savePromptTemplate, updateRunMetadata, updateRunPrompt } from '@/lib/store';
import type { ChatMessage, MemoryFragment, Phase } from '@/lib/types';
import { collectDialogueAnchors } from '@/lib/memory-dialogue-engine';
import { BUILTIN_RUN_ID, buildBuiltinRun } from '@/lib/builtin-simulation';
import { GUARDIAN_RUN_ID, buildGuardianOptimizedRun } from '@/lib/guardian-simulation';

export const runtime = 'edge';

const providerDefaults: Record<string, { baseUrl: string; model: string; envKey: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', envKey: 'QWEN_API_KEY' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-32k', envKey: 'MOONSHOT_API_KEY' },
  siliconflow: { baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', envKey: 'SILICONFLOW_API_KEY' },
};

function customProviderBaseUrl(raw: string) {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error('自定义厂商的 Base URL 无效'); }
  if (parsed.protocol !== 'https:') throw new Error('自定义厂商的 Base URL 必须使用 HTTPS');
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error('自定义厂商的 Base URL 不能指向本地或内网地址');
  return parsed.toString().replace(/\/$/, '');
}

function dateKey(baseIso: string, offsetDays: number) {
  const date = new Date(baseIso);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('模型没有返回可解析的 JSON');
  return JSON.parse(cleaned.slice(first, last + 1));
}

function apiError(status: number, detail: string) {
  const error = new Error(`API ${status}: ${detail}`) as Error & { status?: number };
  error.status = status;
  return error;
}

async function callCompletion(args: { provider: string; model: string; baseUrl: string; apiKey: string; system: string; prompt: string; json?: boolean; maxTokens?: number }) {
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const tokenLimit = args.provider === 'openai' ? { max_completion_tokens: args.maxTokens || 500 } : { max_tokens: args.maxTokens || 500 };
      const sampling = args.provider === 'openai' ? {} : { temperature: args.json ? 0.25 : 1.05 };
      const response = await fetch(`${args.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.apiKey}` },
        body: JSON.stringify({ model: args.model, ...sampling, ...tokenLimit, ...(args.json ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'system', content: args.system }, { role: 'user', content: args.prompt }] }),
      });
      const body = await response.text();
      if (!response.ok) {
        let detail = body.slice(0, 500);
        try { const parsed = JSON.parse(body); detail = parsed.error?.message ?? detail; } catch {}
        if ((response.status === 429 || response.status >= 500) && attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1))); lastError = detail; continue; }
        throw apiError(response.status, detail);
      }
      const result = JSON.parse(body);
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new Error('模型返回为空，可能触发了长度限制或内容过滤');
      if (result.choices?.[0]?.finish_reason === 'length') throw new Error('模型回复因长度限制被截断');
      return String(content).trim();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 2 && /fetch|network|timeout|429|5\d\d/i.test(lastError)) { await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1))); continue; }
      throw error;
    }
  }
  throw new Error(lastError || '模型调用失败');
}

function splitBubbles(text: string) {
  const cleaned = text.replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '').trim();
  return cleaned.split(/\n+/).map((line) => line.replace(/^[-*•\d.、\s]+/, '').replace(/^(用户|守护者|Agent|小精灵)\s*[：:]/i, '').replace(/^（.*?）\s*/, '').trim()).filter(Boolean).slice(0, 4).map((line) => line.slice(0, 260));
}

function frameworkPath(domain: string) {
  if (domain === 'relationship') return '03_Relationship_Record';
  if (domain === 'permission') return '04_Privacy_and_Permission';
  if (domain === 'social_intent') return '05_Matching_Profile.Social_Intent';
  return `01_Self_Memory.${domain}`;
}

type SessionSlot = { phase: Phase; date: string; seedIndex: number };

function distributedOffsets(days: number, count: number, startOffset: number) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => startOffset + Math.min(days - 1, Math.floor(((index + .5) * days) / count)));
}

function buildSchedule(activityClass: 'A' | 'B' | 'C' | 'D', historicalDays: number, futureDays: number, scale: number, createdAt: string): SessionSlot[] {
  const weekly = { A: 7, B: 3.5, C: .9, D: .35 }[activityClass];
  const factor = Math.max(.2, scale / 50);
  const count = (days: number, phase: Phase) => {
    const raw = (days / 7) * weekly * factor;
    if (activityClass === 'A') return Math.min(days, Math.max(1, Math.round(raw)));
    if (activityClass === 'D') return phase === 'historical' ? Math.max(1, Math.round(raw)) : Math.max(0, Math.floor(raw));
    return Math.max(1, Math.min(days, Math.round(raw)));
  };
  const historicalCount = count(historicalDays, 'historical');
  const futureCount = count(futureDays, 'future');
  return [
    ...distributedOffsets(historicalDays, historicalCount, -historicalDays).map((offset, index) => ({ phase: 'historical' as const, date: dateKey(createdAt, offset), seedIndex: index })),
    ...distributedOffsets(futureDays, futureCount, 0).map((offset, index) => ({ phase: 'future' as const, date: dateKey(createdAt, offset), seedIndex: historicalCount + index })),
  ];
}

function knownMemoryText(memories: MemoryFragment[]) {
  if (!memories.length) return '';
  return memories.slice(-24).map((memory) => `- ${memory.content}（${memory.evidenceType}，置信度 ${Math.round(memory.confidence * 100)}%）`).join('\n');
}

function sessionTurnPairs(activityClass: 'A' | 'B' | 'C' | 'D', scale: number) {
  const base = { A: 3, B: 3, C: 4, D: 2 }[activityClass];
  return Math.max(2, Math.min(5, base + (scale >= 80 ? 1 : 0)));
}

async function extractSessionMemories(args: { provider: string; model: string; baseUrl: string; apiKey: string; runId: string; personaId: string; date: string; phase: Phase; messages: ChatMessage[] }) {
  try {
    const refs = new Map<string, string>();
    const transcript = args.messages.map((message, index) => { const ref = `m${index + 1}`; refs.set(ref, message.id); return { ref, speaker: message.speaker, content: message.content }; });
    const extractionPrompt = buildMemoryExtractionPrompt({ date: args.date, phase: args.phase, transcript });
    let raw: string;
    try {
      raw = await callCompletion({ ...args, system: '你是保守、基于证据的 Memory 抽取器。只返回合法 JSON。', prompt: extractionPrompt, json: true, maxTokens: 1400 });
    } catch (error) {
      if (!/response_format|json_object|unsupported|API 400/i.test(error instanceof Error ? error.message : String(error))) throw error;
      raw = await callCompletion({ ...args, system: '你是保守、基于证据的 Memory 抽取器。只返回合法 JSON，不要 Markdown。', prompt: extractionPrompt, maxTokens: 1400 });
    }
    let payload: Record<string, unknown>;
    try {
      payload = parseJson(raw) as Record<string, unknown>;
    } catch {
      const repaired = await callCompletion({ ...args, system: '修复 JSON，只返回修复后的合法 JSON。', prompt: `请修复下面的输出，不得增添新事实：\n${raw}`, maxTokens: 1400 });
      payload = parseJson(repaired) as Record<string, unknown>;
    }
    const summary = typeof payload.summary === 'string' ? payload.summary.slice(0, 500) : '';
    return (Array.isArray(payload.updates) ? payload.updates : []).flatMap((rawItem) => {
      if (!rawItem || typeof rawItem !== 'object') return [];
      const item = rawItem as Record<string, unknown>;
      if (!item.content) return [];
      const sourceMessageIds = (Array.isArray(item.source_refs) ? item.source_refs : []).map((ref: unknown) => refs.get(String(ref))).filter(Boolean) as string[];
      if (!sourceMessageIds.length) return [];
      const domain = String(item.domain || 'inner');
      return [{ id: crypto.randomUUID(), runId: args.runId, personaId: args.personaId, dayKey: args.date, phase: args.phase, domain, kind: String(item.kind || 'fact'), content: String(item.content).slice(0, 320), confidence: Math.max(0, Math.min(1, Number(item.confidence) || .5)), evidenceType: String(item.evidence_type || 'inferred'), privacy: String(item.privacy || 'normal'), socialIntent: Boolean(item.social_intent), sourceMessageIds, status: String(item.status || 'active'), frameworkPath: String(item.framework_path || frameworkPath(domain)), dailySummary: summary || undefined } satisfies MemoryFragment];
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get('runId');
    const personaId = request.nextUrl.searchParams.get('personaId') || undefined;
    if (runId) {
      if (runId === GUARDIAN_RUN_ID) {
        return NextResponse.json(buildGuardianOptimizedRun(personaId));
      }
      if (runId === BUILTIN_RUN_ID) {
        return NextResponse.json(buildBuiltinRun(personaId));
      }
      const data = await getRunData(runId, personaId);
      if (!data) return NextResponse.json({ error: '实验不存在' }, { status: 404 });
      return NextResponse.json({ ...data, personaSource: personaId ? getPersonaSource(personaId) : undefined });
    }
    if (personaId) return NextResponse.json({ personaSource: getPersonaSource(personaId), profile: getPersonaSummaries().find((item) => item.id === personaId) });
    const [storedRuns, promptTemplates] = await Promise.all([listRuns(), listPromptTemplates()]);
    const builtinRun = buildBuiltinRun().run;
    const guardianRun = buildGuardianOptimizedRun().run;
    return NextResponse.json({ personas: getPersonaSummaries(), promptTemplates, runs: [guardianRun, builtinRun, ...storedRuns.filter((run) => run.id !== BUILTIN_RUN_ID && run.id !== GUARDIAN_RUN_ID)] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (input.action === 'create_run') {
      const selectedIds = Array.isArray(input.selectedIds) ? input.selectedIds.filter((id: unknown) => /^U\d{2}$/.test(String(id))) : [];
      if (!selectedIds.length) throw new Error('请至少选择 1 个用户');
      const provider = String(input.provider || 'deepseek');
      const customProviderName = String(input.customProviderName || '').trim();
      if (provider === 'custom') {
        if (!customProviderName) throw new Error('请填写自定义 API 厂商名称');
        customProviderBaseUrl(String(input.baseUrl || ''));
      }
      const model = String(input.model || providerDefaults[provider]?.model || '').trim();
      if (!model) throw new Error('请填写模型名称');
      const run = await createRun({ name: String(input.name || `Memory 实验 ${new Date().toLocaleDateString('zh-CN')}`), provider: provider === 'custom' ? customProviderName.slice(0, 60) : provider, model, historicalDays: Math.max(7, Math.min(90, Number(input.historicalDays) || 28)), futureDays: 14, densityScale: Math.max(10, Math.min(100, Number(input.densityScale) || 30)), selectedIds, promptTemplateId: String(input.promptTemplateId || ''), promptName: String(input.promptName || ''), userPrompt: String(input.userPrompt || ''), agentPrompt: String(input.agentPrompt || ''), guardianSpec: String(input.guardianSpec || '') });
      const summaries = getPersonaSummaries();
      await initializeRunTasks(run.id, selectedIds.map((personaId) => {
        const profile = summaries.find((item) => item.id === personaId)!;
        const totalSessions = buildSchedule(profile.activityClass, run.historicalDays, run.futureDays, run.densityScale, run.createdAt).length;
        return { personaId, totalSessions };
      }));
      return NextResponse.json({ run });
    }
    if (input.action === 'save_prompt') {
      const name = String(input.name || '').trim();
      const userPrompt = String(input.userPrompt || '').trim();
      const agentPrompt = String(input.agentPrompt || '').trim();
      const guardianSpec = String(input.guardianSpec || '').trim();
      if (!name || !userPrompt || !agentPrompt) throw new Error('Prompt 名称、用户 Prompt 和 Agent Prompt 都不能为空');
      const prompt = await savePromptTemplate({ id: input.id ? String(input.id) : undefined, name, userPrompt, agentPrompt, guardianSpec });
      return NextResponse.json({ prompt });
    }
    if (input.action === 'update_run_prompt') {
      const runId = String(input.runId || '');
      if (!runId || runId === BUILTIN_RUN_ID || runId === GUARDIAN_RUN_ID) throw new Error('内置版本通过共享 Prompt 模板更新');
      await updateRunPrompt(runId, { id: String(input.promptTemplateId || ''), name: String(input.promptName || ''), userPrompt: String(input.userPrompt || ''), agentPrompt: String(input.agentPrompt || ''), guardianSpec: String(input.guardianSpec || '') });
      return NextResponse.json({ ok: true });
    }
    if (input.action === 'update_run') {
      const runId = String(input.runId || '');
      const name = String(input.name || '').trim();
      const notes = String(input.notes || '').trim();
      if (!runId || !name || runId === BUILTIN_RUN_ID || runId === GUARDIAN_RUN_ID) throw new Error('内置基线不能修改');
      await updateRunMetadata(runId, name, notes);
      return NextResponse.json({ ok: true, name, notes });
    }
    if (input.action === 'delete_run') {
      const runId = String(input.runId || '');
      if (!runId || runId === BUILTIN_RUN_ID || runId === GUARDIAN_RUN_ID) throw new Error('内置基线不能删除');
      await deleteRun(runId);
      return NextResponse.json({ ok: true });
    }
    if (input.action === 'reset_failed_tasks') {
      const runId = String(input.runId || '');
      if (!runId || runId === BUILTIN_RUN_ID || runId === GUARDIAN_RUN_ID) throw new Error('该实验不能续跑');
      const personaIds = await resetFailedTasks(runId);
      return NextResponse.json({ ok: true, personaIds });
    }
    if (input.action === 'simulate_step' || input.action === 'simulate_persona') {
      const runId = String(input.runId || '');
      const personaId = String(input.personaId || '');
      const foundProfile = getPersonaSummaries().find((item) => item.id === personaId);
      if (!runId || !foundProfile) throw new Error('实验或用户参数无效');
      const profile = foundProfile;
      const provider = String(input.provider || 'deepseek');
      const isCustomProvider = provider === 'custom';
      const defaults = providerDefaults[provider] ?? { baseUrl: '', model: '', envKey: 'LLM_API_KEY' };
      const model = String(input.model || defaults.model);
      if (!model.trim()) throw new Error('请填写模型名称');
      const envVars = env as unknown as Record<string, string | undefined>;
      const apiKey = request.headers.get('x-llm-api-key') || envVars[defaults.envKey] || envVars.LLM_API_KEY || '';
      if (!apiKey) throw new Error(`未检测到 API Key。可临时输入，或配置 ${defaults.envKey} / LLM_API_KEY 环境变量。`);
      const rawBaseUrl = String(input.baseUrl || envVars[`${provider.toUpperCase()}_BASE_URL`] || envVars.LLM_BASE_URL || defaults.baseUrl);
      if (isCustomProvider && !rawBaseUrl) throw new Error('未知厂商需要填写 OpenAI-compatible Base URL');
      const baseUrl = isCustomProvider ? customProviderBaseUrl(rawBaseUrl) : rawBaseUrl;
      const profileJson = buildProfileForPrompt(personaId);
      const runData = await getRunData(runId, personaId);
      if (!runData) throw new Error('实验不存在');
      let task = await getSimulationTask(runId, personaId);
      if (!task) {
        const schedule = buildSchedule(profile.activityClass, runData.run.historicalDays, runData.run.futureDays, runData.run.densityScale, runData.run.createdAt);
        await initializeRunTasks(runId, [{ personaId, totalSessions: schedule.length }]);
        task = await getSimulationTask(runId, personaId);
      }
      if (!task) throw new Error('无法初始化模拟任务');
      if (task.status === 'completed' || task.status === 'failed') return NextResponse.json({ ok: task.status === 'completed', done: true, task });
      const userPrompt = runData.run.userPrompt;
      const agentPrompt = runData.run.agentPrompt;
      const guardianSpec = runData.run.guardianSpec;
      const schedule = buildSchedule(profile.activityClass, runData.run.historicalDays, runData.run.futureDays, runData.run.densityScale, runData.run.createdAt);
      const slot = schedule[task.nextSession];
      if (!slot) {
        const finished = await appendSessionResult({ runId, personaId, model, messages: [], memories: [], nextSession: schedule.length, totalSessions: schedule.length });
        return NextResponse.json({ ok: true, done: true, task: finished });
      }
      try {
        const source = getPersonaSource(personaId);
        if (!source) throw new Error('找不到用户原始 Memory');
        const anchors = collectDialogueAnchors(source, profile);
        const anchor = anchors[slot.seedIndex % anchors.length];
        const eventSeed = `${anchor.topic}。事实素材：${anchor.memory}。请把它变成今天刚发生或刚想起的具体生活片段，不要照抄结构化措辞。`;
        const prior = runData.messages.slice(-36).map((message) => ({ speaker: message.speaker, content: message.content }));
        const session: Array<{ speaker: 'user' | 'agent'; content: string }> = [];
        const messageRows: ChatMessage[] = [];
        const sessionId = `${runId}-${personaId}-${task.nextSession}`;
        const startHour = 12 + ((slot.seedIndex * 7 + Number(personaId.slice(1))) % 11);
        const baseTime = new Date(`${slot.date}T${String(startHour).padStart(2, '0')}:${String((slot.seedIndex * 13) % 60).padStart(2, '0')}:00+08:00`).getTime();
        let sequence = runData.messages.reduce((maximum, message) => Math.max(maximum, message.sequence + 1), 0);
        const plan = activityPlan(profile.activityClass, 7, runData.run.densityScale);
        const pairs = sessionTurnPairs(profile.activityClass, runData.run.densityScale);
        for (let turn = 0; turn < pairs; turn += 1) {
          const userRaw = await callCompletion({ provider, model, baseUrl, apiKey, system: '你只扮演指定的真实用户。不要替守护者说话，也不要解释模拟过程。', prompt: buildUserTurnPrompt({ template: userPrompt, profileJson, phase: slot.phase, date: slot.date, baseline: plan.baseline, agent: profile.agent, guardianSpec, transcript: [...prior, ...session], userName: profile.name, eventSeed, turnIndex: turn }), maxTokens: 380 });
          const userBubbles = splitBubbles(userRaw);
          if (!userBubbles.length) throw new Error('用户角色返回了空消息');
          for (const content of userBubbles) {
            session.push({ speaker: 'user', content });
            messageRows.push({ id: crypto.randomUUID(), runId, personaId, phase: slot.phase, sessionId, timestamp: new Date(baseTime + messageRows.length * 75_000).toISOString(), speaker: 'user', content, sequence: sequence++ });
          }
          const agentRaw = await callCompletion({ provider, model, baseUrl, apiKey, system: '你只扮演用户的长期 AI 守护者。只回应已经说出口的内容，不得读取或猜测隐藏人设。', prompt: buildGuardianTurnPrompt({ template: agentPrompt, phase: slot.phase, date: slot.date, baseline: plan.baseline, agent: profile.agent, guardianSpec, transcript: [...prior, ...session], knownMemory: knownMemoryText(runData.memories), userName: profile.name }), maxTokens: 380 });
          const agentBubbles = splitBubbles(agentRaw);
          if (!agentBubbles.length) throw new Error('守护者角色返回了空消息');
          for (const content of agentBubbles) {
            session.push({ speaker: 'agent', content });
            messageRows.push({ id: crypto.randomUUID(), runId, personaId, phase: slot.phase, sessionId, timestamp: new Date(baseTime + messageRows.length * 75_000).toISOString(), speaker: 'agent', content, sequence: sequence++ });
          }
        }
        const memories = await extractSessionMemories({ provider, model, baseUrl, apiKey, runId, personaId, date: slot.date, phase: slot.phase, messages: messageRows });
        const nextTask = await appendSessionResult({ runId, personaId, model, messages: messageRows, memories, nextSession: task.nextSession + 1, totalSessions: schedule.length });
        return NextResponse.json({ ok: true, personaId, done: nextTask?.status === 'completed', session: task.nextSession + 1, totalSessions: schedule.length, messageCount: messageRows.length, memoryCount: memories.length, task: nextTask });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const status = (error as Error & { status?: number }).status;
        const permanent = status === 401 || status === 402 || status === 403 || status === 404;
        const nextTask = await recordTaskError(runId, personaId, slot.phase, reason, permanent);
        return NextResponse.json({ error: reason, personaId, phase: slot.phase, retryable: nextTask?.status !== 'failed', done: nextTask?.status === 'failed', task: nextTask }, { status: permanent ? 400 : 502 });
      }
    }
    throw new Error('未知操作');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '请求失败' }, { status: 400 });
  }
}
