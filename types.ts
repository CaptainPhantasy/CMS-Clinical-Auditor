export enum AppMode {
  TRANSLATOR = 'TRANSLATOR',
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  HISTORY = 'HISTORY'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface MockAuditResult {
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  auditorFeedback: string;
  missingCriteria: string[];
}

export interface TranslationResult {
  text: string;
  groundingChunks?: GroundingChunk[];
  mockAudit?: MockAuditResult;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  input: string;
  result: TranslationResult;
  tags?: string[]; // e.g., inferred DME category
}

export interface ImageAttachment {
  data: string; // Base64 string
  mimeType: string;
  previewUrl: string;
}