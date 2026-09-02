# TIL Notes — 카드뉴스 자동화

`studio.html`(TIL Notes Studio)로 만들던 카드뉴스의 "초안 생성 → 사진 검색 → 카드 렌더링"
단계를 매주 화/목/일 자동으로 실행합니다. **인스타그램 업로드는 검토 후 직접** 합니다.

## 전체 흐름

1. GitHub Actions가 화/목/일 아침(KST 08:00)에 실행됩니다.
2. Notion "Today You Learned" 페이지의 `IDEA` 목록에서 아직 체크되지 않은 첫 항목을 가져옵니다.
3. Claude API로 `studio.html`과 동일한 프롬프트를 보내 카드 문구·캡션 초안(JSON)을 받습니다.
4. 각 카드의 `photoKeyword`로 Pexels에서 무료 스톡 사진을 자동 검색해 붙입니다.
5. `studio.html`을 headless 브라우저로 열어, 그 안의 렌더링 함수를 그대로 사용해
   카드를 1080×1350 PNG로 그립니다 (수동으로 만든 카드와 동일한 결과).
6. 결과를 `output/YYYY-MM-DD-카테고리-번호/`에 커밋·푸시합니다:
   - `01.png`, `02.png`, … — 카드별 이미지
   - `caption.txt` — 인스타 캡션
   - `topic.txt` — 이번에 사용한 주제
   - `credits.txt` — 사용한 사진 출처(Pexels 작가명·링크)
   - `project.json` — **studio.html의 "작업 불러오기"로 바로 열 수 있는 파일**
7. 사용한 IDEA 항목은 Notion에서 체크박스로 자동 표시됩니다(성공했을 때만).

## 검토·수정 후 업로드하는 방법

1. `git pull`로 새로 생성된 `output/...` 폴더를 받습니다.
2. `studio.html`을 브라우저로 열고 "작업 불러오기" → 방금 받은 `project.json` 선택.
3. 문구를 고치거나, 사진을 바꾸거나(직접 업로드/붙여넣기), 위치·확대를 조정합니다.
4. 미리보기에서 카드별로 PNG를 다시 내려받아 인스타그램에 업로드합니다.
5. `caption.txt` 내용을 다듬어서 게시물 캡션으로 붙여넣습니다.

사진 검색이나 초안 문구가 마음에 안 들면 `project.json`을 굳이 쓰지 않고, `studio.html`에서
주제를 다시 입력해 처음부터 만들 수도 있습니다.

## 최초 설정

### 1. Notion
1. [notion.so/my-integrations](https://www.notion.so/my-integrations)에서 내부 통합(internal integration)을 만들고 토큰을 복사합니다.
2. "Today You Learned" 페이지 우측 상단 `···` → `Connections`에서 방금 만든 통합을 연결합니다(공유해야 API로 읽고 쓸 수 있습니다).
3. 페이지 URL 끝의 32자리 문자열이 페이지 ID입니다 (예: `https://www.notion.so/Today-You-Learned-<32자리 ID>` → `<32자리 ID>` 부분).
4. 페이지 하단에 `IDEA`라는 제목(Heading) 아래 주제 목록이 있어야 합니다. 지금처럼 체크박스가 없는
   일반 목록이어도 됩니다 — 자동화가 처음 실행될 때 각 항목을 체크박스(할 일) 블록으로 자동 변환합니다.

### 2. Pexels (무료 스톡 사진)
[pexels.com/api](https://www.pexels.com/api/)에서 무료로 API 키를 발급받습니다.

### 3. Anthropic (카드 문구 생성)
[console.anthropic.com](https://console.anthropic.com/)에서 API 키를 발급받습니다.

### 4. GitHub 저장소 Secrets 등록
저장소 `Settings` → `Secrets and variables` → `Actions`에서 다음 Secrets를 추가합니다:

| 이름 | 값 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API 키 |
| `NOTION_TOKEN` | Notion 통합 토큰 |
| `NOTION_PAGE_ID` | "Today You Learned" 페이지 ID |
| `PEXELS_API_KEY` | Pexels API 키 |

필요하면 `Variables` 탭에 `ANTHROPIC_MODEL`을 추가해 기본 모델(`claude-sonnet-5`)을 바꿀 수 있습니다.

### 5. 실행 확인
`Actions` 탭 → `Card News Automation` → `Run workflow`로 수동 실행해서 정상 동작하는지 먼저 확인하세요.
스케줄은 매주 월/수/토 UTC 23:00 (KST 화/목/일 08:00)에 자동 실행됩니다. 필요하면
`.github/workflows/card-news.yml`의 `cron` 값을 조정하세요.

## 로컬에서 직접 실행하기

```bash
npm install
npx playwright install --with-deps chromium
ANTHROPIC_API_KEY=... NOTION_TOKEN=... NOTION_PAGE_ID=... PEXELS_API_KEY=... npm run generate
```

## 파일 구조

```
studio.html              카드뉴스 편집 도구 (기존 그대로, 수동 작업에도 계속 사용)
automation/
  generate.mjs            전체 파이프라인 실행 스크립트
  fileno.json             마지막으로 사용한 파일 번호 (자동 갱신)
  lib/
    prompt.mjs             studio.html과 동일한 초안 생성 프롬프트
    notion.mjs              IDEA 목록 조회 · 체크 표시
    claude.mjs               Claude API로 초안(JSON) 생성
    pexels.mjs                 photoKeyword로 무료 스톡 사진 검색
    render.mjs                   studio.html의 렌더러를 headless 브라우저로 재사용해 PNG 생성
.github/workflows/card-news.yml   화/목/일 자동 실행 워크플로
output/YYYY-MM-DD-카테고리-번호/   생성 결과 (PNG, 캡션, project.json)
```
