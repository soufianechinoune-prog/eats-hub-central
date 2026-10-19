export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export function recentMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((m): m is ChatMessage => m !== null && typeof m === 'object' &&
    (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && Boolean(m.content.trim())).slice(-12);
}

export const TITLE_REQUEST = { model: 'claude-haiku-5-5', max_tokens: 30 };
export function normalizeTitle(value: string) {
  return value.trim().replace(/^["«]+|["»]+$/g, '').split(/\s+/).slice(0, 6).join(' ');
}
export function shouldGenerateTitle(hasAssistant: boolean, failed: boolean, answer: string) {
  return !hasAssistant && !failed && Boolean(answer.trim());
}