import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchImageForKeyword } from './lib/pexels.mjs';
import { renderCards } from './lib/render.mjs';

/**
 * 이미 만들어둔 project.json에 카드(예: 빠진 KEY TAKEAWAY/마무리)를 추가하고
 * 전체를 다시 그린다. AI 초안이 필수 카드 구성을 빠뜨렸을 때 수동으로 보정하는 용도.
 * 사용법: node automation/append-cards.mjs "output/카테고리/번호_주제" '[{"type":"takeaway",...}, ...]'
 */
function withDefaults(card) {
  return {
    type: card.type,
    title: card.title || '',
    sub: card.sub || '',
    text: card.text || '',
    note: card.note || '',
    photoSrc: card.photoSrc || '',
    textSrc: card.textSrc || '',
    photoSrcLabel: true,
    textSrcLabel: true,
    photoKeyword: card.photoKeyword || '',
    imgUrl: '',
    imgOff: null,
    imgScale: 1,
  };
}

async function main() {
  const [dir, cardsJson] = process.argv.slice(2);
  if (!dir || !cardsJson) {
    console.error('사용법: node automation/append-cards.mjs "output/카테고리/번호_주제" \'[{"type":"takeaway",...}]\'');
    process.exit(1);
  }

  const projectPath = path.join(dir, 'project.json');
  const project = JSON.parse(await fs.readFile(projectPath, 'utf8'));
  const newCards = JSON.parse(cardsJson).map(withDefaults);

  const newCredits = [];
  for (const card of newCards) {
    if (!card.photoKeyword) continue;
    const photo = await fetchImageForKeyword(card.photoKeyword);
    if (!photo) continue;
    card.imgUrl = photo.dataUrl;
    if (!card.photoSrc) card.photoSrc = `Pexels, ${photo.photographer}`;
    newCredits.push(`[${card.type}] ${photo.photographer} - ${photo.pageUrl}`);
  }

  project.cards = [...project.cards, ...newCards];
  await fs.writeFile(projectPath, JSON.stringify(project), 'utf8');

  if (newCredits.length) {
    const creditsPath = path.join(dir, 'credits.txt');
    let existing = '';
    try { existing = await fs.readFile(creditsPath, 'utf8'); } catch {}
    const combined = [existing.trim(), newCredits.join('\n')].filter(Boolean).join('\n');
    await fs.writeFile(creditsPath, combined + '\n', 'utf8');
  }

  console.log(`[append-cards] ${dir}: 카드 ${newCards.length}개 추가, 총 ${project.cards.length}장 다시 그리는 중...`);
  const pngDataUrls = await renderCards({
    category: project.cat,
    fileno: project.fileno,
    cards: project.cards,
  });

  await Promise.all(
    pngDataUrls.map((dataUrl, i) => {
      const base64 = dataUrl.split(',')[1];
      const name = `${String(i + 1).padStart(2, '0')}.png`;
      return fs.writeFile(path.join(dir, name), Buffer.from(base64, 'base64'));
    })
  );
  console.log(`[append-cards] 완료: ${dir} (총 ${project.cards.length}장)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
