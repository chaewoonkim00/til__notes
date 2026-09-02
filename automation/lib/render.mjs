import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_PATH = path.resolve(__dirname, '..', '..', 'studio.html');

/**
 * studio.html을 headless 브라우저로 열어, 그 안에 이미 정의된 render()/CATS를
 * 그대로 재사용해 카드를 그린다. 이렇게 하면 수동으로 만든 카드와
 * 픽셀 단위로 동일한 결과물이 나오고, 렌더링 로직을 두 곳에서 관리하지 않아도 된다.
 * 반환값은 카드 순서대로의 PNG data URL 배열.
 */
export async function renderCards({ category, fileno, cards }) {
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
  );
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log('[render:page]', msg.text()));
    page.on('pageerror', (err) => console.error('[render:pageerror]', err.message));

    await page.goto('file://' + STUDIO_PATH);
    await page.waitForFunction(() => typeof window.render === 'function' || typeof render === 'function');

    // studio.html 자체의 폰트 로딩 타이밍에 기대지 않고, 렌더링 전에 직접
    // 모든 카테고리 폰트를 명시적으로 로드해서 기본 폰트로 대체되는 걸 막는다.
    const fontStatus = await page.evaluate(async () => {
      const fams = [
        'Nanum Gothic Coding', 'Nanum Myeongjo', 'Song Myung',
        'Gowun Batang', 'Gowun Dodum', 'IBM Plex Sans KR',
      ];
      const weights = [400, 500, 600, 700, 800];
      const jobs = [];
      for (const f of fams) {
        for (const w of weights) {
          jobs.push(document.fonts.load(`${w} 100px "${f}"`).catch(() => {}));
        }
      }
      await Promise.all(jobs);
      await document.fonts.ready;
      const loaded = new Set();
      document.fonts.forEach((f) => { if (f.status === 'loaded') loaded.add(f.family); });
      return { totalFontFaces: document.fonts.size, loadedFamilies: [...loaded] };
    });
    console.log('[render] font status:', JSON.stringify(fontStatus));
    if (fontStatus.totalFontFaces === 0) {
      console.warn('[render] 경고: Google Fonts 스타일시트가 로드되지 않았습니다 (네트워크 문제일 수 있음). 기본 폰트로 렌더링됩니다.');
    }

    const pngDataUrls = await page.evaluate(
      async ({ category, fileno, cards }) => {
        function loadImage(url) {
          return new Promise((resolve, reject) => {
            if (!url) return resolve(null);
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = () => reject(new Error('이미지 로드 실패'));
            im.src = url;
          });
        }
        const bodyTotal = cards.filter((c) => c.type === 'body').length || 1;
        let bodyIdx = 0;
        const out = [];
        for (const raw of cards) {
          const card = Object.assign({}, raw);
          card.img = await loadImage(card.imgUrl);
          let pageNo = 1;
          let total = bodyTotal;
          if (card.type === 'body') {
            bodyIdx += 1;
            pageNo = bodyIdx;
          }
          const cv = document.createElement('canvas');
          render(cv, card, category, fileno, pageNo, total);
          out.push(cv.toDataURL('image/png'));
        }
        return out;
      },
      { category, fileno, cards }
    );

    return pngDataUrls;
  } finally {
    await browser.close();
  }
}
