import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = process.env.NOTION_PAGE_ID;

function plainText(block) {
  const rich = block[block.type]?.rich_text || [];
  return rich.map((t) => t.plain_text).join('').trim();
}

async function listChildren(blockId) {
  const results = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

/**
 * "IDEA" 제목 아래 목록을 찾아 체크박스(to_do) 블록으로 통일하고,
 * 아직 체크되지 않은 첫 항목을 돌려준다. 없으면 null.
 */
export async function getNextTopic() {
  if (!PAGE_ID) throw new Error('NOTION_PAGE_ID 환경 변수가 설정되지 않았습니다.');
  const children = await listChildren(PAGE_ID);
  const ideaIdx = children.findIndex((b) => /^heading_/.test(b.type) && /idea/i.test(plainText(b)));
  if (ideaIdx === -1) {
    throw new Error('Notion 페이지에서 "IDEA" 제목을 찾지 못했습니다. 목록 위에 IDEA라는 제목(Heading)이 있는지 확인하세요.');
  }

  const section = [];
  for (let i = ideaIdx + 1; i < children.length; i++) {
    const b = children[i];
    if (/^heading_/.test(b.type)) break;
    section.push(b);
  }

  // 체크박스가 아닌 항목(불릿/번호 목록)은 같은 자리에 to_do 블록으로 바꿔서 상태를 남길 수 있게 한다.
  let afterId = children[ideaIdx].id;
  const todos = [];
  for (const b of section) {
    if (b.type === 'to_do') {
      todos.push(b);
      afterId = b.id;
      continue;
    }
    if (b.type === 'bulleted_list_item' || b.type === 'numbered_list_item') {
      const text = plainText(b);
      afterId = b.id;
      if (!text) continue;
      const appended = await notion.blocks.children.append({
        block_id: PAGE_ID,
        after: afterId,
        children: [{ to_do: { rich_text: [{ text: { content: text } }], checked: false } }],
      });
      const newBlock = appended.results[0];
      await notion.blocks.delete({ block_id: b.id });
      todos.push(newBlock);
      afterId = newBlock.id;
    } else {
      afterId = b.id;
    }
  }

  const next = todos.find((t) => !t.to_do.checked);
  if (!next) return null;
  return { blockId: next.id, text: plainText(next) };
}

export async function markTopicDone(blockId) {
  await notion.blocks.update({ block_id: blockId, to_do: { checked: true } });
}
