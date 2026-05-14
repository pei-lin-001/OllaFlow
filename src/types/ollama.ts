export interface OllamaGenerateRequest {
  model: string;
  prompt?: string;
  suffix?: string;
  images?: string[];
  format?: string | object;
  system?: string;
  template?: string;
  stream?: boolean;
  think?: boolean | 'high' | 'medium' | 'low';
  raw?: boolean;
  keep_alive?: string | number;
  context?: number[];
  options?: Record<string, unknown>;
  logprobs?: boolean;
  top_logprobs?: number;
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
    thinking?: string;
    images?: string[];
    tool_calls?: Array<{
      function: { name: string; arguments: object };
    }>;
    tool_name?: string;
  }>;
  tools?: Array<{
    type: 'function';
    function: { name: string; description?: string; parameters: object };
  }>;
  format?: string | object;
  options?: Record<string, unknown>;
  stream?: boolean;
  think?: boolean | 'high' | 'medium' | 'low';
  keep_alive?: string | number;
  logprobs?: boolean;
  top_logprobs?: number;
}

export interface OllamaEmbedRequest {
  model: string;
  input: string | string[];
  truncate?: boolean;
  dimensions?: number;
  keep_alive?: string | number;
  options?: Record<string, unknown>;
}

export interface TokenLogprob {
  token: string;
  logprob: number;
  bytes?: number[];
}

export interface LogprobEntry {
  token: string;
  logprob: number;
  bytes?: number[];
  top_logprobs?: TokenLogprob[];
}

export interface OllamaUsage {
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  logprobs?: LogprobEntry[];
}

export interface OllamaErrorResponse {
  error: string;
}

export interface OllamaStreamChunk extends Partial<OllamaUsage> {
  model?: string;
  created_at?: string;
  response?: string;
  thinking?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
    tool_calls?: unknown[];
    images?: string[];
  };
  done?: boolean;
  done_reason?: string;
  context?: number[];
  status?: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
  image?: string;
}