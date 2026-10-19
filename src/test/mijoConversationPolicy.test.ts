import { describe, expect, it } from 'vitest';
import { recentMessages, TITLE_REQUEST, normalizeTitle, shouldGenerateTitle } from '../../supabase/functions/ai-advisor/conversationPolicy';

describe('Mijo conversation rules', () => {
  it('keeps only the last 12 user/assistant messages, including the current question', () => {
    const input = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i) }));
    const result = recentMessages(input);
    expect(result).toHaveLength(12);
    expect(result[0].content).toBe('13');
    expect(result[11]).toEqual({ role: 'user', content: '24' });
  });
  it('uses Haiku with 30 output tokens and no tools', () => {
    expect(TITLE_REQUEST).toEqual({ model: 'claude-haiku-5-5', max_tokens: 30 });
    expect(TITLE_REQUEST).not.toHaveProperty('tools');
  });
  it('generates a title only after a first successful answer', () => {
    expect(shouldGenerateTitle(false, false, 'Réponse')).toBe(true);
    expect(shouldGenerateTitle(true, false, 'Réponse')).toBe(false);
    expect(shouldGenerateTitle(false, true, 'Erreur')).toBe(false);
    expect(shouldGenerateTitle(false, false, '')).toBe(false);
  });
  it('limits generated titles to six words', () => {
    expect(normalizeTitle('Un deux trois quatre cinq six sept')).toBe('Un deux trois quatre cinq six');
  });
});