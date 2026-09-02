import fs from 'node:fs/promises';
import path from 'node:path';
import { getNextTopic, markTopicDone } from './lib/notion.mjs';
import { getDraft } from './lib/claude.mjs';
import { fetchImageForKeyword } from './lib/pexels.mjs';
import { renderCards } from './lib/render.mjs';
import { nextFileNo } from './lib/fileno.mjs';

const VALID_CATS = ['TECH', 'SCIENCE', 'HISTORY', 'CULTURE', 'BUSINESS', 'LIFESTYLE'];

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
    src: card.src || '',
    photoKeyword: card.photoKeyword || '',
    imgUrl: '',
    imgOff: null,
    imgScale: 1,
  };
}

async function main() {
  const topic = await getNextTopic();
  if (!topic) {
    console.log('Notion IDEA 목록에 아직 사용하지 않은 주제가 없습니다. 이번 실행은 건너뜁니다.');
    return;
  }
  console.log(`주제 선택: ${topic.text}`);

  const draft = await getDraft(topic.text);
  const category = VALID_CATS.includes(draft.category) ? draft.category : 'LIFESTYLE';
  const fileno = await nextFileNo();
  const cards = draft.cards.map(withDefaults);

  const credits = [];
  for (const card of cards) {
    if (!card.photoKeyword) continue;
    const photo = await fetchImageForKeyword(card.photoKeyword);
    if (!photo) continue;
    card.imgUrl = photo.dataUrl;
    if (!card.photoSrc) card.photoSrc = `Pexels, ${photo.photographer}`;
    credits.push(`[${card.type}] ${photo.photographer} - ${photo.pageUrl}`);
  }

  console.log(`카드 ${cards.length}장 렌더링 중...`);
  const pngDataUrls = await renderCards({ category, fileno, cards });

  const date = new Date().toISOString().slice(0, 10);
  const dir = path.resolve('output', `${date}-${category}-${fileno}`);
  await fs.mkdir(dir, { recursive: true });

  await Promise.all(
    pngDataUrls.map((dataUrl, i) => {
      const base64 = dataUrl.split(',')[1];
      const name = `${String(i + 1).padStart(2, '0')}.png`;
      return fs.writeFile(path.join(dir, name), Buffer.from(base64, 'base64'));
    })
  );

  await fs.writeFile(path.join(dir, 'topic.txt'), topic.text, 'utf8');
  await fs.writeFile(path.join(dir, 'caption.txt'), draft.caption || '', 'utf8');
  if (credits.length) {
    await fs.writeFile(path.join(dir, 'credits.txt'), credits.join('\n'), 'utf8');
  }

  // studio.html의 "작업 저장" 포맷과 동일하게 만든다 -> "작업 불러오기"로 그대로 열어 다듬을 수 있다.
  const project = {
    version: 1,
    savedAt: new Date().toISOString(),
    cat: category,
    fileno,
    topic: topic.text,
    caption: draft.caption || '',
    cards: cards.map((c) => ({
      type: c.type,
      title: c.title,
      sub: c.sub,
      text: c.text,
      note: c.note,
      photoSrc: c.photoSrc,
      textSrc: c.textSrc,
      photoKeyword: c.photoKeyword,
      photoSrcLabel: true,
      textSrcLabel: true,
      imgOff: null,
      imgScale: 1,
      imgUrl: c.imgUrl,
    })),
  };
  await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(project), 'utf8');

  await markTopicDone(topic.blockId);
  console.log(`생성 완료: ${dir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
