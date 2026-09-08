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
};

