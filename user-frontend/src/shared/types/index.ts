// Shared domain types matching backend API responses

export interface User {
  id: string;
  email: string;
  provider: string;
  role?: string;
  languageCode?: string;
}

export interface Bot {
  _id: string;
  name: string;
  description?: string;
  avatar?: string;
}

export interface ChatSession {
  _id: string;
  userId: string;
  botId: Bot | string;
  title?: string;
  lockedLanguageCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ClientMemory {
  _id: string;
  userId: string;
  botId: string | { _id: string; name: string; avatar?: string };
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Language {
  _id: string;
  code: string;
  name: string;
  nativeName: string;
}

// API response wrappers
export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface SessionsResponse {
  sessions: ChatSession[];
}

export interface MessagesResponse {
  messages: Message[];
}

export interface BotsResponse {
  bots: Bot[];
}

export interface MemoryResponse {
  memory: ClientMemory | null;
}

export interface CounselingStep {
  stepId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  evidence?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CounselingPlan {
  _id: string;
  sessionId: string;
  userId: string;
  botId: string;
  title: string;
  steps: CounselingStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CounselingPlanResponse {
  counselingPlan: CounselingPlan | null;
}
