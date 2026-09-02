// photoKeyword는 "한국어 검색어 / english keyword" 형식으로 온다.
// 무료 스톡 사진 검색은 영어 키워드로 하는 편이 결과가 훨씬 좋다.
function pickQuery(keyword) {
  if (!keyword) return null;
  const parts = String(keyword).split('/');
  const q = (parts[1] || parts[0]).trim();
  return q || null;
}

export async function fetchImageForKeyword(keyword) {
  const apiKey = process.env.PEXELS_API_KEY;
  const query = pickQuery(keyword);
  if (!query) return null;
  if (!apiKey) {
    console.warn('PEXELS_API_KEY가 없어 사진 검색을 건너뜁니다.');
    return null;
  }

  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=portrait`;
  const res = await fetch(searchUrl, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    console.warn(`Pexels 검색 실패 (${res.status}): ${query}`);
    return null;
  }
  const data = await res.json();
  const photo = data.photos?.[0];
  if (!photo) {
    console.warn(`Pexels 검색 결과 없음: ${query}`);
    return null;
  }

  const imgUrl = photo.src.large2x || photo.src.large || photo.src.original;
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) {
    console.warn(`Pexels 이미지 다운로드 실패 (${imgRes.status}): ${imgUrl}`);
    return null;
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get('content-type') || 'image/jpeg';

  return {
    dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    photographer: photo.photographer,
    pageUrl: photo.url,
  };
}
