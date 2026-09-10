import { env } from 'cloudflare:workers';
import type { ChatMessage, MemoryFragment, PromptTemplate, RunRecord } from './types';
import { DEFAULT_PROMPT_TEMPLATE, GUARDIAN_PROMPT_TEMPLATE } from './prompts';

let schemaReady = false;

function db(): D1Database {
  if (!env.DB) throw new Error('共享数据库暂不可用，请确认 Sites D1 绑定。');
  return env.DB;
}

export async function ensureSchema() {
  if (schemaReady) return;
  await db().batch([
    db().prepare(`CREATE TABLE IF NOT EXISTS simulation_runs (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, provider TEXT NOT NULL, model TEXT NOT NULL, historical_days INTEGER NOT NULL, future_days INTEGER NOT NULL, density_scale INTEGER NOT NULL, selected_count INTEGER NOT NULL, completed_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0, error_summary TEXT, selected_ids_json TEXT NOT NULL)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, persona_id TEXT NOT NULL, phase TEXT NOT NULL, session_id TEXT NOT NULL, timestamp TEXT NOT NULL, speaker TEXT NOT NULL, content TEXT NOT NULL, sequence INTEGER NOT NULL, model TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS messages_run_persona_idx ON chat_messages(run_id, persona_id)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS messages_timestamp_idx ON chat_messages(timestamp)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS memory_fragments (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, persona_id TEXT NOT NULL, day_key TEXT NOT NULL, phase TEXT NOT NULL, domain TEXT NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, confidence INTEGER NOT NULL, evidence_type TEXT NOT NULL, privacy TEXT NOT NULL, social_intent INTEGER NOT NULL, source_message_ids_json TEXT NOT NULL, status TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS memory_run_persona_idx ON memory_fragments(run_id, persona_id)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS memory_day_idx ON memory_fragments(day_key)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS simulation_failures (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, persona_id TEXT NOT NULL, phase TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS failures_run_idx ON simulation_failures(run_id)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS prompt_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_prompt TEXT NOT NULL, agent_prompt TEXT NOT NULL, guardian_spec TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS prompt_templates_updated_idx ON prompt_templates(updated_at)`),
  ]);
  const columns = await db().prepare(`PRAGMA table_info(memory_fragments)`).all();
  const columnNames = new Set((columns.results as Array<{ name: string }>).map((column) => column.name));
  if (!columnNames.has('framework_path')) await db().prepare(`ALTER TABLE memory_fragments ADD COLUMN framework_path TEXT`).run();
  if (!columnNames.has('daily_summary')) await db().prepare(`ALTER TABLE memory_fragments ADD COLUMN daily_summary TEXT`).run();
  const runColumns = await db().prepare(`PRAGMA table_info(simulation_runs)`).all();
  const runColumnNames = new Set((runColumns.results as Array<{ name: string }>).map((column) => column.name));
  if (!runColumnNames.has('prompt_template_id')) await db().prepare(`ALTER TABLE simulation_runs ADD COLUMN prompt_template_id TEXT`).run();
  if (!runColumnNames.has('prompt_name')) await db().prepare(`ALTER TABLE simulation_runs ADD COLUMN prompt_name TEXT`).run();
  if (!runColumnNames.has('user_prompt')) await db().prepare(`ALTER TABLE simulation_runs ADD COLUMN user_prompt TEXT`).run();
  if (!runColumnNames.has('agent_prompt')) await db().prepare(`ALTER TABLE simulation_runs ADD COLUMN agent_prompt TEXT`).run();
  if (!runColumnNames.has('guardian_spec')) await db().prepare(`ALTER TABLE simulation_runs ADD COLUMN guardian_spec TEXT`).run();
  if (!runColumnNames.has('notes')) await db().prepare(`ALTER TABLE simulation_runs ADD COLUMN notes TEXT`).run();
  const promptColumns = await db().prepare(`PRAGMA table_info(prompt_templates)`).all();
  const promptColumnNames = new Set((promptColumns.results as Array<{ name: string }>).map((column) => column.name));
  if (!promptColumnNames.has('guardian_spec')) await db().prepare(`ALTER TABLE prompt_templates ADD COLUMN guardian_spec TEXT NOT NULL DEFAULT ''`).run();
  schemaReady = true;
}

function mapRun(row: Record<string, unknown>): RunRecord {
  return {
    id: String(row.id), name: String(row.name), status: String(row.status), createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null, provider: String(row.provider), model: String(row.model), historicalDays: Number(row.historical_days), futureDays: Number(row.future_days), densityScale: Number(row.density_scale), selectedCount: Number(row.selected_count), completedCount: Number(row.completed_count), failedCount: Number(row.failed_count), errorSummary: row.error_summary ? String(row.error_summary) : null, promptTemplateId: row.prompt_template_id ? String(row.prompt_template_id) : undefined, promptName: row.prompt_name ? String(row.prompt_name) : undefined, userPrompt: row.user_prompt ? String(row.user_prompt) : undefined, agentPrompt: row.agent_prompt ? String(row.agent_prompt) : undefined, guardianSpec: row.guardian_spec ? String(row.guardian_spec) : undefined, notes: row.notes ? String(row.notes) : undefined,
  };
}

export async function listRuns() {
  await ensureSchema();
  const result = await db().prepare(`SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT 30`).all();
  return (result.results as Record<string, unknown>[]).map(mapRun);
}

export async function createRun(input: { name: string; provider: string; model: string; historicalDays: number; futureDays: number; densityScale: number; selectedIds: string[]; promptTemplateId?: string; promptName?: string; userPrompt?: string; agentPrompt?: string; guardianSpec?: string }) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db().prepare(`INSERT INTO simulation_runs (id,name,status,created_at,provider,model,historical_days,future_days,density_scale,selected_count,completed_count,failed_count,selected_ids_json,prompt_template_id,prompt_name,user_prompt,agent_prompt,guardian_spec) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?,?)`)
    .bind(id, input.name, 'running', createdAt, input.provider, input.model, input.historicalDays, input.futureDays, input.densityScale, input.selectedIds.length, JSON.stringify(input.selectedIds), input.promptTemplateId ?? null, input.promptName ?? null, input.userPrompt ?? null, input.agentPrompt ?? null, input.guardianSpec ?? null).run();
  return { id, name: input.name, status: 'running', createdAt, completedAt: null, provider: input.provider, model: input.model, historicalDays: input.historicalDays, futureDays: input.futureDays, densityScale: input.densityScale, selectedCount: input.selectedIds.length, completedCount: 0, failedCount: 0, errorSummary: null, promptTemplateId: input.promptTemplateId, promptName: input.promptName, userPrompt: input.userPrompt, agentPrompt: input.agentPrompt, guardianSpec: input.guardianSpec } satisfies RunRecord;
}

function mapPrompt(row: Record<string, unknown>): PromptTemplate {
  return { id: String(row.id), name: String(row.name), userPrompt: String(row.user_prompt), agentPrompt: String(row.agent_prompt), guardianSpec: row.guardian_spec ? String(row.guardian_spec) : '', createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

export async function listPromptTemplates() {
  await ensureSchema();
  const result = await db().prepare(`SELECT * FROM prompt_templates ORDER BY updated_at DESC`).all();
  const stored = (result.results as Record<string, unknown>[]).map(mapPrompt);
  const builtins = [GUARDIAN_PROMPT_TEMPLATE, DEFAULT_PROMPT_TEMPLATE].map((builtin) => {
    const override = stored.find((item) => item.id === builtin.id);
    return override ? { ...override, builtin: true } : builtin;
  });
  return [...builtins, ...stored.filter((item) => !builtins.some((builtin) => builtin.id === item.id))];
}

export async function savePromptTemplate(input: { id?: string; name: string; userPrompt: string; agentPrompt: string; guardianSpec?: string }) {
  await ensureSchema();
  const id = input.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const existing = await db().prepare(`SELECT created_at FROM prompt_templates WHERE id=?`).bind(id).first<Record<string, unknown>>();
  await db().prepare(`INSERT INTO prompt_templates (id,name,user_prompt,agent_prompt,guardian_spec,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,user_prompt=excluded.user_prompt,agent_prompt=excluded.agent_prompt,guardian_spec=excluded.guardian_spec,updated_at=excluded.updated_at`)
    .bind(id, input.name.slice(0, 80), input.userPrompt.slice(0, 24000), input.agentPrompt.slice(0, 24000), (input.guardianSpec || '').slice(0, 60000), existing?.created_at ? String(existing.created_at) : now, now).run();
  return { id, name: input.name.slice(0, 80), userPrompt: input.userPrompt.slice(0, 24000), agentPrompt: input.agentPrompt.slice(0, 24000), guardianSpec: (input.guardianSpec || '').slice(0, 60000), createdAt: existing?.created_at ? String(existing.created_at) : now, updatedAt: now, builtin: id === DEFAULT_PROMPT_TEMPLATE.id || id === GUARDIAN_PROMPT_TEMPLATE.id } satisfies PromptTemplate;
}

export async function updateRunMetadata(runId: string, name: string, notes: string) {
  await ensureSchema();
  await db().prepare(`UPDATE simulation_runs SET name=?,notes=? WHERE id=?`).bind(name.slice(0, 80), notes.slice(0, 1000), runId).run();
}

export async function deleteRun(runId: string) {
  await ensureSchema();
  const existing = await db().prepare(`SELECT id FROM simulation_runs WHERE id=?`).bind(runId).first();
  if (!existing) throw new Error('实验不存在或已删除');
  await db().batch([
    db().prepare(`DELETE FROM chat_messages WHERE run_id=?`).bind(runId),
    db().prepare(`DELETE FROM memory_fragments WHERE run_id=?`).bind(runId),
    db().prepare(`DELETE FROM simulation_failures WHERE run_id=?`).bind(runId),
    db().prepare(`DELETE FROM simulation_runs WHERE id=?`).bind(runId),
  ]);
}

export async function updateRunPrompt(runId: string, prompt: { id: string; name: string; userPrompt: string; agentPrompt: string; guardianSpec?: string }) {
  await ensureSchema();
  await db().prepare(`UPDATE simulation_runs SET prompt_template_id=?,prompt_name=?,user_prompt=?,agent_prompt=?,guardian_spec=? WHERE id=?`)
    .bind(prompt.id, prompt.name, prompt.userPrompt, prompt.agentPrompt, prompt.guardianSpec ?? null, runId).run();
}

export async function savePersonaResult(runId: string, personaId: string, model: string, messages: ChatMessage[], memories: MemoryFragment[]) {
  await ensureSchema();
  const statements = [
    db().prepare(`DELETE FROM chat_messages WHERE run_id=? AND persona_id=?`).bind(runId, personaId),
    db().prepare(`DELETE FROM memory_fragments WHERE run_id=? AND persona_id=?`).bind(runId, personaId),
    db().prepare(`DELETE FROM simulation_failures WHERE run_id=? AND persona_id=?`).bind(runId, personaId),
    ...messages.map((m) => db().prepare(`INSERT INTO chat_messages (id,run_id,persona_id,phase,session_id,timestamp,speaker,content,sequence,model) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(m.id, runId, personaId, m.phase, m.sessionId, m.timestamp, m.speaker, m.content, m.sequence, model)),
    ...memories.map((m) => db().prepare(`INSERT INTO memory_fragments (id,run_id,persona_id,day_key,phase,domain,kind,content,confidence,evidence_type,privacy,social_intent,source_message_ids_json,status,framework_path,daily_summary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(m.id, runId, personaId, m.dayKey, m.phase, m.domain, m.kind, m.content, Math.round(m.confidence * 100), m.evidenceType, m.privacy, m.socialIntent ? 1 : 0, JSON.stringify(m.sourceMessageIds), m.status, m.frameworkPath ?? null, m.dailySummary ?? null)),
    db().prepare(`UPDATE simulation_runs SET completed_count=completed_count+1 WHERE id=?`).bind(runId),
  ];
  for (let i = 0; i < statements.length; i += 75) await db().batch(statements.slice(i, i + 75));
  await refreshRunStatus(runId);
}

export async function saveFailure(runId: string, personaId: string, phase: string, message: string) {
  await ensureSchema();
  await db().batch([
    db().prepare(`DELETE FROM simulation_failures WHERE run_id=? AND persona_id=?`).bind(runId, personaId),
    db().prepare(`INSERT INTO simulation_failures (id,run_id,persona_id,phase,message,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), runId, personaId, phase, message.slice(0, 1200), new Date().toISOString()),
    db().prepare(`UPDATE simulation_runs SET failed_count=failed_count+1, error_summary=? WHERE id=?`).bind(`${personaId}: ${message.slice(0, 180)}`, runId),
  ]);
  await refreshRunStatus(runId);
}

async function refreshRunStatus(runId: string) {
  const result = await db().prepare(`SELECT selected_count,completed_count,failed_count FROM simulation_runs WHERE id=?`).bind(runId).first<Record<string, number>>();
  if (!result) return;
  const finished = Number(result.completed_count) + Number(result.failed_count) >= Number(result.selected_count);
  if (finished) {
    const status = Number(result.completed_count) === 0 ? 'failed' : Number(result.failed_count) > 0 ? 'partial' : 'completed';
    await db().prepare(`UPDATE simulation_runs SET status=?,completed_at=? WHERE id=?`).bind(status, new Date().toISOString(), runId).run();
  }
}

export async function getRunData(runId: string, personaId?: string) {
  await ensureSchema();
  const runRow = await db().prepare(`SELECT * FROM simulation_runs WHERE id=?`).bind(runId).first<Record<string, unknown>>();
  if (!runRow) return null;
  const suffix = personaId ? ` AND persona_id=?` : '';
  const messageQuery = db().prepare(`SELECT * FROM chat_messages WHERE run_id=?${suffix} ORDER BY timestamp,sequence`).bind(...(personaId ? [runId, personaId] : [runId]));
  const memoryQuery = db().prepare(`SELECT * FROM memory_fragments WHERE run_id=?${suffix} ORDER BY day_key,id`).bind(...(personaId ? [runId, personaId] : [runId]));
  const failureQuery = db().prepare(`SELECT * FROM simulation_failures WHERE run_id=?${suffix} ORDER BY created_at`).bind(...(personaId ? [runId, personaId] : [runId]));
  const [messageResult, memoryResult, failureResult] = await db().batch([messageQuery, memoryQuery, failureQuery]);
  const messages = (messageResult.results as Record<string, unknown>[]).map((r) => ({ id: String(r.id), runId: String(r.run_id), personaId: String(r.persona_id), phase: String(r.phase), sessionId: String(r.session_id), timestamp: String(r.timestamp), speaker: String(r.speaker), content: String(r.content), sequence: Number(r.sequence) }));
  const memories = (memoryResult.results as Record<string, unknown>[]).map((r) => ({ id: String(r.id), runId: String(r.run_id), personaId: String(r.persona_id), dayKey: String(r.day_key), phase: String(r.phase), domain: String(r.domain), kind: String(r.kind), content: String(r.content), confidence: Number(r.confidence) / 100, evidenceType: String(r.evidence_type), privacy: String(r.privacy), socialIntent: Boolean(r.social_intent), sourceMessageIds: JSON.parse(String(r.source_message_ids_json || '[]')), status: String(r.status), frameworkPath: r.framework_path ? String(r.framework_path) : undefined, dailySummary: r.daily_summary ? String(r.daily_summary) : undefined }));
  return { run: mapRun(runRow), selectedIds: JSON.parse(String(runRow.selected_ids_json || '[]')), messages, memories, failures: failureResult.results };
}
