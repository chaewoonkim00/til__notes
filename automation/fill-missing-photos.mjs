import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchImageForKeyword } from './lib/pexels.mjs';
import { renderCards } from './lib/render.mjs';

/**
 * project.json의 카드 중 photoKeyword는 있는데 imgUrl이 비어 있는 카드(예: 사진
 * 검색 API 키가 아직 등록되기 전에 만들어진 초기 게시물)에 사진을 다시 채워 넣고
 * 전체를 다시 그린다.
 * 사용법: node automation/fill-missing-photos.mjs "output/카테고리/번호_주제"
 */
async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('사용법: node automation/fill-missing-photos.mjs "output/카테고리/번호_주제"');
    process.exit(1);
  }

  const projectPath = path.join(dir, 'project.json');
  const project = JSON.parse(await fs.readFile(projectPath, 'utf8'));

  const credits = [];
  let filled = 0;
  for (const card of project.cards) {
    if (card.imgUrl || !card.photoKeyword) continue;
    const photo = await fetchImageForKeyword(card.photoKeyword);
    if (!photo) {
      console.warn(`[fill-missing-photos] 사진을 못 찾음: ${card.type} / ${card.photoKeyword}`);
      continue;
    }
    card.imgUrl = photo.dataUrl;
    if (!card.photoSrc) card.photoSrc = `Pexels, ${photo.photographer}`;
    credits.push(`[${card.type}] ${photo.photographer} - ${photo.pageUrl}`);
    filled += 1;
  }

  if (!filled) {
    console.log('[fill-missing-photos] 채울 사진이 없습니다.');
    return;
  }

  await fs.writeFile(projectPath, JSON.stringify(project), 'utf8');

  if (credits.length) {
    const creditsPath = path.join(dir, 'credits.txt');
    let existing = '';
    try { existing = await fs.readFile(creditsPath, 'utf8'); } catch {}
    const combined = [existing.trim(), credits.join('\n')].filter(Boolean).join('\n');
    await fs.writeFile(creditsPath, combined + '\n', 'utf8');
  }

  console.log(`[fill-missing-photos] ${dir}: 사진 ${filled}장 채움, 다시 그리는 중...`);
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
  console.log(`[fill-missing-photos] 완료: ${dir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
