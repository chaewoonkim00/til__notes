import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.resolve(__dirname, '..', 'fileno.json');

export async function nextFileNo() {
  let last = 0;
  try {
    const data = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
    last = Number(data.last) || 0;
  } catch {
    // 파일이 없으면 0에서 시작
  }
  const next = last + 1;
  await fs.writeFile(STATE_FILE, JSON.stringify({ last: next }, null, 2), 'utf8');
  return String(next).padStart(3, '0');
}
