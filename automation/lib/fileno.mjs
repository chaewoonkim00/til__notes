import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.resolve(__dirname, '..', 'fileno.json');

/**
 * 카테고리별로 001부터 순번을 매긴다 (예: SCIENCE 001, SCIENCE 002, ...).
 * 사용자가 studio.html로 수동 작업할 때도 카테고리별 폴더에 이 번호를
 * 그대로 쓰고 있어서, 자동화 결과물도 같은 규칙을 따른다.
 */
export async function nextFileNo(category) {
  let state = {};
  try {
    state = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    // 파일이 없으면 빈 상태에서 시작
  }
  const next = (Number(state[category]) || 0) + 1;
  state[category] = next;
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  return String(next).padStart(3, '0');
}
