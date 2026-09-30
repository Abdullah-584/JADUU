/** Ollama HTTP API types (local, wire-compatible). */
export interface OllamaTag {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  details?: { family?: string; parameter_size?: string; quantization_level?: string };
}

export interface TagsResponse {
  models?: OllamaTag[];
}

export interface ChatRequestMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatRequestMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
  };
}

export interface GenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  system?: string;
  options?: { temperature?: number };
}

export interface ChatStreamChunk {
  model?: string;
  created_at?: string;
  message?: { role: string; content: string };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
}

export interface GenerateStreamChunk {
  model?: string;
  response?: string;
  done?: boolean;
}
