import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt } from './prompt.mjs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// 표지 1장, 본문 4~7장, KEY TAKEAWAY 1장, 마무리 1장 구성을 강제한다.
// 이 구성을 벗어나면(예: 본문만 있고 KEY TAKEAWAY·마무리가 빠진 경우) 결과물이
// 카드뉴스 형식을 갖추지 못한 채 조용히 만들어지므로, 여기서 걸러낸다.
function validateCards(cards) {
  if (!Array.isArray(cards) || !cards.length) {
    return 'cards 배열이 없습니다.';
  }
  const counts = cards.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
  if (counts.cover !== 1) return `cover 카드는 정확히 1장이어야 합니다 (현재 ${counts.cover || 0}장).`;
  if (!counts.body || counts.body < 4 || counts.body > 7) {
    return `body 카드는 4~7장이어야 합니다 (현재 ${counts.body || 0}장).`;
  }
  if (counts.takeaway !== 1) return `takeaway 카드는 정확히 1장이어야 합니다 (현재 ${counts.takeaway || 0}장).`;
  if (counts.outro !== 1) return `outro 카드는 정확히 1장이어야 합니다 (현재 ${counts.outro || 0}장).`;
  if (cards[0].type !== 'cover' || cards[cards.length - 1].type !== 'outro') {
    return 'cards 배열의 첫 장은 cover, 마지막 장은 outro여야 합니다.';
  }
  return null;
}

async function requestDraft(client, prompt) {
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
  return parsed;
}

export async function getDraft(topic) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(topic);

  let parsed = await requestDraft(client, prompt);
  let problem = validateCards(parsed.cards);

  if (problem) {
    console.warn(`[claude] 카드 구성 오류, 재시도합니다: ${problem}`);
    const retryPrompt = `${prompt}\n\n(주의: 이전 응답은 다음 문제로 반려되었다 — "${problem}" 반드시 표지 1장 + 본문 4~7장 + KEY TAKEAWAY 1장 + 마무리 1장을 모두 포함한 cards 배열을 출력하라.)`;
    parsed = await requestDraft(client, retryPrompt);
    problem = validateCards(parsed.cards);
    if (problem) {
      throw new Error(`Claude 응답의 카드 구성이 올바르지 않습니다: ${problem}`);
    }
  }

  return parsed;
}
