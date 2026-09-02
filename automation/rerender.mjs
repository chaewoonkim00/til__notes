import fs from 'node:fs/promises';
import path from 'node:path';
import { renderCards } from './lib/render.mjs';

/**
 * 이미 만들어둔 project.json(카드 문구·사진 포함)을 studio.html 렌더러로
 * 다시 그린다. 폰트 교체나 템플릿 수정 후 기존 결과물을 새로 반영할 때 쓴다.
 * 사용법: node automation/rerender.mjs "output/카테고리/번호_주제" [...더 많은 폴더]
 */
async function rerenderOne(dir) {
  const projectPath = path.join(dir, 'project.json');
  const project = JSON.parse(await fs.readFile(projectPath, 'utf8'));

  console.log(`[rerender] ${dir} (${project.cat} ${project.fileno})`);
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
  console.log(`[rerender] 완료: ${dir}`);
}

async function main() {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('사용법: node automation/rerender.mjs "output/카테고리/번호_주제" [...]');
    process.exit(1);
  }
  for (const dir of dirs) {
    await rerenderOne(dir);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
