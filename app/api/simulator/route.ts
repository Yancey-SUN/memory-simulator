import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { activityPlan, buildProfileForPrompt, getPersonaSource, getPersonaSummaries } from '@/lib/personas';
import { buildConversationPrompt } from '@/lib/prompts';
import { createRun, getRunData, listRuns, saveFailure, savePersonaResult } from '@/lib/store';
import type { ChatMessage, MemoryFragment, Phase } from '@/lib/types';
import { BUILTIN_RUN_ID, buildBuiltinRun } from '@/lib/builtin-simulation';

export const runtime = 'edge';

const providerDefaults: Record<string, { baseUrl: string; model: string; envKey: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', envKey: 'OPENAI_API_KEY' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', envKey: 'QWEN_API_KEY' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-32k', envKey: 'MOONSHOT_API_KEY' },
  siliconflow: { baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', envKey: 'SILICONFLOW_API_KEY' },
};

function dateKey(offsetDays: number) {
  const date = new Date();
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

async function callModel(provider: string, model: string, baseUrl: string, apiKey: string, prompt: string) {
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const tokenLimit = provider === 'openai' ? { max_completion_tokens: 8000 } : { max_tokens: 8000 };
      const sampling = provider === 'openai' ? {} : { temperature: provider === 'deepseek' ? 1.15 : 0.95 };
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, ...sampling, ...tokenLimit, messages: [{ role: 'system', content: '你是严谨的对话模拟与记忆证据生成器。只返回合法 JSON。' }, { role: 'user', content: prompt }] }),
      });
      const body = await response.text();
      if (!response.ok) {
        let detail = body.slice(0, 500);
        try { const parsed = JSON.parse(body); detail = parsed.error?.message ?? detail; } catch {}
        if ((response.status === 429 || response.status >= 500) && attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1))); lastError = detail; continue; }
        throw new Error(`${provider} API ${response.status}: ${detail}`);
      }
      const result = JSON.parse(body);
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new Error('模型返回为空，可能触发了长度限制或内容过滤');
      if (result.choices?.[0]?.finish_reason === 'length') throw new Error('模型回复因长度限制被截断，请降低对话密度后重试');
      return parseJson(content);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 2 && /fetch|network|timeout|429|5\d\d/i.test(lastError)) { await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1))); continue; }
      throw error;
    }
  }
  throw new Error(lastError || '模型调用失败');
}

function normalizePhase(payload: any, phase: Phase, runId: string, personaId: string, sequenceStart: number) {
  const messages: ChatMessage[] = [];
  const memories: MemoryFragment[] = [];
  const refMap = new Map<string, string>();
  let sequence = sequenceStart;
  for (const [sessionIndex, session] of (Array.isArray(payload?.sessions) ? payload.sessions : []).entries()) {
    const sessionId = `${personaId}-${phase}-${sessionIndex + 1}`;
    const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(session.date) ? session.date : dateKey(phase === 'historical' ? -1 : 0);
    const baseTime = /^\d{2}:\d{2}$/.test(session.start_time) ? session.start_time : '20:00';
    const base = new Date(`${baseDate}T${baseTime}:00+08:00`).getTime();
    for (const [index, item] of (Array.isArray(session.messages) ? session.messages : []).entries()) {
      if (!item?.text || !['user', 'agent'].includes(item.speaker)) continue;
      const id = crypto.randomUUID();
      const timestamp = new Date(base + Math.max(0, Number(item.offset_minutes) || index) * 60_000).toISOString();
      messages.push({ id, runId, personaId, phase, sessionId, timestamp, speaker: item.speaker, content: String(item.text).replace(/^（.*?）/, '').slice(0, 220), sequence: sequence++ });
      if (item.ref) refMap.set(String(item.ref), id);
    }
  }
  for (const item of (Array.isArray(payload?.memory_fragments) ? payload.memory_fragments : [])) {
    if (!item?.content) continue;
    const sourceMessageIds = (Array.isArray(item.source_refs) ? item.source_refs : []).map((ref: unknown) => refMap.get(String(ref))).filter(Boolean) as string[];
    if (!sourceMessageIds.length) continue;
    memories.push({ id: crypto.randomUUID(), runId, personaId, dayKey: /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : messages.find((m) => sourceMessageIds.includes(m.id))?.timestamp.slice(0, 10) ?? dateKey(0), phase, domain: String(item.domain || 'inner'), kind: String(item.kind || 'fact'), content: String(item.content).slice(0, 320), confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)), evidenceType: String(item.evidence_type || 'inferred'), privacy: String(item.privacy || 'normal'), socialIntent: Boolean(item.social_intent), sourceMessageIds, status: String(item.status || 'active') });
  }
  return { messages, memories, nextSequence: sequence };
}

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get('runId');
    const personaId = request.nextUrl.searchParams.get('personaId') || undefined;
    if (runId) {
      if (runId === BUILTIN_RUN_ID) return NextResponse.json(buildBuiltinRun(personaId));
      const data = await getRunData(runId, personaId);
      if (!data) return NextResponse.json({ error: '实验不存在' }, { status: 404 });
      return NextResponse.json({ ...data, personaSource: personaId ? getPersonaSource(personaId) : undefined });
    }
    if (personaId) return NextResponse.json({ personaSource: getPersonaSource(personaId), profile: getPersonaSummaries().find((item) => item.id === personaId) });
    const storedRuns = await listRuns();
    return NextResponse.json({ personas: getPersonaSummaries(), runs: [buildBuiltinRun().run, ...storedRuns.filter((run) => run.id !== BUILTIN_RUN_ID)] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => ({})) as Record<string, any>;
  try {
    if (input.action === 'create_run') {
      const selectedIds = Array.isArray(input.selectedIds) ? input.selectedIds.filter((id: unknown) => /^U\d{2}$/.test(String(id))) : [];
      if (!selectedIds.length) throw new Error('请至少选择 1 个用户');
      const run = await createRun({ name: String(input.name || `Memory 实验 ${new Date().toLocaleDateString('zh-CN')}`), provider: String(input.provider || 'deepseek'), model: String(input.model || 'deepseek-chat'), historicalDays: Math.max(7, Math.min(90, Number(input.historicalDays) || 28)), futureDays: 14, densityScale: Math.max(10, Math.min(100, Number(input.densityScale) || 30)), selectedIds });
      return NextResponse.json({ run });
    }
    if (input.action === 'simulate_persona') {
      const runId = String(input.runId || '');
      const personaId = String(input.personaId || '');
      const profile = getPersonaSummaries().find((item) => item.id === personaId);
      if (!runId || !profile) throw new Error('实验或用户参数无效');
      const provider = String(input.provider || 'deepseek');
      const defaults = providerDefaults[provider] ?? providerDefaults.deepseek;
      const model = String(input.model || defaults.model);
      const envVars = env as unknown as Record<string, string | undefined>;
      const apiKey = request.headers.get('x-llm-api-key') || envVars[defaults.envKey] || envVars.LLM_API_KEY || '';
      if (!apiKey) throw new Error(`未检测到 API Key。可临时输入，或配置 ${defaults.envKey} / LLM_API_KEY 环境变量。`);
      const baseUrl = String(input.baseUrl || envVars[`${provider.toUpperCase()}_BASE_URL`] || envVars.LLM_BASE_URL || defaults.baseUrl);
      const historicalDays = Math.max(7, Math.min(90, Number(input.historicalDays) || 28));
      const futureDays = 14;
      const scale = Math.max(10, Math.min(100, Number(input.densityScale) || 30));
      const profileJson = buildProfileForPrompt(personaId);
      const historicalPlan = activityPlan(profile.activityClass, historicalDays, scale);
      const futurePlan = activityPlan(profile.activityClass, futureDays, scale);
      let stage: Phase = 'historical';
      try {
        const historicalPayload = historicalPlan.sessionCount ? await callModel(provider, model, baseUrl, apiKey, buildConversationPrompt({ profileJson, phase: 'historical', startDate: dateKey(-historicalDays), endDate: dateKey(-1), ...historicalPlan, agent: profile.agent })) : { sessions: [], memory_fragments: [] };
        const historical = normalizePhase(historicalPayload, 'historical', runId, personaId, 0);
        stage = 'future';
        const priorTranscript = historical.messages.slice(-60).map((m) => `${m.speaker === 'user' ? profile.name : profile.agent.name}：${m.content}`).join('\n');
        const futurePayload = futurePlan.sessionCount ? await callModel(provider, model, baseUrl, apiKey, buildConversationPrompt({ profileJson, phase: 'future', startDate: dateKey(0), endDate: dateKey(futureDays - 1), ...futurePlan, agent: profile.agent, priorTranscript })) : { sessions: [], memory_fragments: [] };
        const future = normalizePhase(futurePayload, 'future', runId, personaId, historical.nextSequence);
        const messages = [...historical.messages, ...future.messages];
        const memories = [...historical.memories, ...future.memories];
        if (!messages.length) throw new Error('模型未生成有效对话');
        await savePersonaResult(runId, personaId, model, messages, memories);
        return NextResponse.json({ ok: true, personaId, messageCount: messages.length, memoryCount: memories.length });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await saveFailure(runId, personaId, stage, reason);
        return NextResponse.json({ error: reason, personaId, phase: stage }, { status: 502 });
      }
    }
    throw new Error('未知操作');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '请求失败' }, { status: 400 });
  }
}
