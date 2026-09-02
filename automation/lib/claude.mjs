import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt } from './prompt.mjs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

export async function getDraft(topic) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(topic);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Claude 응답을 JSON으로 읽지 못했습니다: ${e.message}\n원본: ${raw.slice(0, 400)}`);
  }
  if (!Array.isArray(parsed.cards) || !parsed.cards.length) {
    throw new Error('Claude 응답에 cards 배열이 없습니다.');
  }
  return parsed;
}
