export type Speaker = 'user' | 'agent';
export type Phase = 'historical' | 'future';

export type PersonaSummary = {
  id: string;
  name: string;
  age: number;
  gender: string;
  city: string;
  group: string;
  activityClass: 'A' | 'B' | 'C' | 'D';
  activityLabel: string;
  topic: string;
  usagePattern: string;
  hardCase: string | null;
  education: string;
  interests: string[];
  socialIntent: string[];
  currentIssue: string;
  tags: Record<string, string>;
  agent: AgentCard;
};

export type AgentCard = {
  name: string;
  voice: string;
  values: string;
  principle: string;
  imperfection: string;
  interests: string;
  archetype?: string;
  dayMaster?: string;
  element?: string;
  yinYang?: string;
  resonance?: string[];
  regulation?: string[];
  compiledSignature?: Record<string, string>;
  traits?: Record<string, number>;
};

export type ChatMessage = {
  id: string;
  runId: string;
  personaId: string;
  phase: Phase;
  sessionId: string;
  timestamp: string;
  speaker: Speaker;
  content: string;
  sequence: number;
};

export type MemoryFragment = {
  id: string;
  runId: string;
  personaId: string;
  dayKey: string;
  domain: string;
  kind: string;
  content: string;
  confidence: number;
  evidenceType: string;
  privacy: string;
  socialIntent: boolean;
  sourceMessageIds: string[];
  status: string;
  phase: Phase;
  frameworkPath?: string;
  dailySummary?: string;
};

export type RunRecord = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  provider: string;
  model: string;
  historicalDays: number;
  futureDays: number;
  densityScale: number;
  selectedCount: number;
  completedCount: number;
  failedCount: number;
  errorSummary: string | null;
  promptTemplateId?: string;
  promptName?: string;
  userPrompt?: string;
  agentPrompt?: string;
  guardianSpec?: string;
};

export type PromptTemplate = {
  id: string;
  name: string;
  userPrompt: string;
  agentPrompt: string;
  guardianSpec: string;
  createdAt: string;
  updatedAt: string;
  builtin?: boolean;
};
