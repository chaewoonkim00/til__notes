import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_PATH = path.resolve(__dirname, '..', 'studio.html');

/**
 * 각 카테고리 폰트가 현대 한글 음절(11,172자)을 실제로 다 그릴 수 있는지
 * 픽셀 단위로 검사한다. 폴백 없이 그 폰트 하나만 지정해서 그렸을 때
 * 흰 캔버스에 아무 것도 안 찍히면(=완전히 빈 칸) 그 글자 글리프가 없다는 뜻이다.
 */
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + STUDIO_PATH);
await page.waitForFunction(() => typeof render === 'function');

const result = await page.evaluate(async () => {
  const fonts = [
    'Nanum Gothic Coding', 'Nanum Myeongjo', 'Noto Serif KR',
    'Gowun Batang', 'Gowun Dodum', 'IBM Plex Sans KR',
    'Noto Sans KR',
  ];
  const weights = [400, 500, 600, 700, 800];
  const jobs = [];
  for (const f of fonts) for (const w of weights) jobs.push(document.fonts.load(`${w} 40px "${f}"`).catch(() => {}));
  await Promise.all(jobs);
  await document.fonts.ready;

  const cv = document.createElement('canvas');
  cv.width = 60; cv.height = 60;
  const ctx = cv.getContext('2d', { willReadFrequently: true });

  function hasGlyph(fontFamily, ch) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 60, 60);
    ctx.fillStyle = '#000';
    ctx.font = `40px "${fontFamily}"`;
    ctx.textBaseline = 'top';
    ctx.fillText(ch, 5, 5);
    const data = ctx.getImageData(0, 0, 60, 60).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) return true;
    }
    return false;
  }

  const report = {};
  for (const f of fonts) {
    const missing = [];
    for (let cp = 0xac00; cp <= 0xd7a3; cp++) {
      const ch = String.fromCodePoint(cp);
      if (!hasGlyph(f, ch)) missing.push(ch);
    }
    report[f] = { total: 0xd7a3 - 0xac00 + 1, missingCount: missing.length, sample: missing.slice(0, 40).join('') };
  }
  return report;
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
