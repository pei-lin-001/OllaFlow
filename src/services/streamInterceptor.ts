import { Transform } from 'stream';
import type { OllamaUsage, OllamaStreamChunk } from '../types/ollama.js';

export interface StreamInterceptorCallbacks {
  onUsage: (usage: OllamaUsage & { model?: string; errorMessage?: string }) => void;
  onErrorChunk?: (error: string) => void;
}

export function createNdjsonInterceptor(callbacks: StreamInterceptorCallbacks): Transform {
  let usage: (OllamaUsage & { model?: string; errorMessage?: string }) | null = null;
  let buffer = '';

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as OllamaStreamChunk;

          if (parsed.error) {
            callbacks.onErrorChunk?.(parsed.error);
          }

          if (parsed.done === true) {
            usage = {
              model: parsed.model,
              total_duration: parsed.total_duration,
              load_duration: parsed.load_duration,
              prompt_eval_count: parsed.prompt_eval_count,
              prompt_eval_duration: parsed.prompt_eval_duration,
              eval_count: parsed.eval_count,
              eval_duration: parsed.eval_duration,
            };
          }
        } catch {
          // Not valid JSON, pass through silently
        }

        this.push(line + '\n');
      }

      callback();
    },
    async flush(callback) {
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as OllamaStreamChunk;
          if (parsed.error) {
            callbacks.onErrorChunk?.(parsed.error);
          }
          if (parsed.done === true) {
            usage = {
              model: parsed.model,
              total_duration: parsed.total_duration,
              load_duration: parsed.load_duration,
              prompt_eval_count: parsed.prompt_eval_count,
              prompt_eval_duration: parsed.prompt_eval_duration,
              eval_count: parsed.eval_count,
              eval_duration: parsed.eval_duration,
            };
          }
        } catch {
          // ignore
        }
        this.push(buffer);
      }

      try {
        if (usage) {
          await callbacks.onUsage(usage);
        } else {
          await callbacks.onUsage({});
        }
        callback();
      } catch (err: any) {
        callback(err);
      }
    },
  });
}

// ── SSE Interceptor for OpenAI-compatible endpoints ───────────────────────

export interface SSEInterceptorCallbacks {
  onUsage: (usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }, model?: string) => void;
  onErrorChunk?: (error: string) => void;
}

export function createSSEInterceptor(callbacks: SSEInterceptorCallbacks): Transform {
  let buffer = '';
  let lastUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
  let lastModel: string | null = null;
  let lastError: string | null = null;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      buffer += chunk.toString('utf8');

      // SSE messages are separated by \n\n
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const message = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        // Push the complete SSE message (including double newline) downstream
        this.push(message + '\n\n');

        // Parse data lines
        const dataLines = message
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());

        for (const dataLine of dataLines) {
          if (dataLine === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataLine);

            // Extract model from any chunk that has it
            if (parsed.model && typeof parsed.model === 'string') {
              lastModel = parsed.model;
            }

            // OpenAI format: usage may appear in the final chunk
            if (parsed.usage) {
              lastUsage = {
                prompt_tokens: parsed.usage.prompt_tokens,
                completion_tokens: parsed.usage.completion_tokens,
                total_tokens: parsed.usage.total_tokens,
              };
            }

            // error handling
            if (parsed.error) {
              const errStr = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
              lastError = errStr;
              callbacks.onErrorChunk?.(errStr);
            }

            // stream_options.include_usage => final chunk has choices:[] and usage:{}
            if (parsed.choices && parsed.choices.length === 0 && parsed.usage) {
              lastUsage = {
                prompt_tokens: parsed.usage.prompt_tokens,
                completion_tokens: parsed.usage.completion_tokens,
                total_tokens: parsed.usage.total_tokens,
              };
            }
          } catch {
            // ignore invalid JSON in SSE data line
          }
        }

        boundary = buffer.indexOf('\n\n');
      }

      callback();
    },
    async flush(callback) {
      if (buffer.length > 0) {
        this.push(buffer);
      }
      try {
        if (lastUsage) {
          await callbacks.onUsage(lastUsage, lastModel ?? undefined);
        } else if (lastError) {
          await callbacks.onUsage({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, lastModel ?? undefined);
        } else {
          await callbacks.onUsage({}, lastModel ?? undefined);
        }
        callback();
      } catch (err: any) {
        callback(err);
      }
    },
  });
}
