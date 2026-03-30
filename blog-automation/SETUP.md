# 🚀 GitHub Actions 자동화 설정 가이드

## 최종 파일 구조

이 폴더의 파일들을 `CorbinKim.github.io` 레포 루트에 복사하세요:

```
CorbinKim.github.io/
├── .github/
│   └── workflows/
│       ├── arxiv-daily-digest.yml      ← 매일 09:00 KST
│       ├── conference-deadlines.yml    ← 매주 월 10:00 KST
│       ├── daily-briefing.yml          ← 매일 08:00 KST
│       ├── weekly-review.yml           ← 매주 일 20:00 KST
│       └── gmail-triage.yml            ← 매일 08:30 KST
├── arxiv_digest.py
├── conference_deadlines.py
├── daily_briefing.py
├── weekly_review.py
├── gmail_triage.py
└── get_google_token.py    ← 로컬에서 1회만 실행 (업로드 불필요)
```

---

## Step 1: Notion Integration Token 발급

1. https://www.notion.so/my-integrations 접속
2. **"+ New integration"** 클릭
3. 이름: `GitHub Actions` / 권한: Read + Insert content 선택
4. **Internal Integration Token** (`secret_...`) 복사

5. Notion에서 다음 데이터베이스/페이지 각각 열기 → 우상단 `...` → **"Connections"** → integration 추가:
   - **📚 Reading List** 데이터베이스
   - **📄 Paper Reviews** 데이터베이스
   - **Academic Planner** 페이지 (Daily Briefing / Weekly Review 생성 위치)

---

## Step 2: Google OAuth 설정 (Gmail Triage용)

### 2-1. Google Cloud Console 설정

1. https://console.cloud.google.com/ 접속 → 새 프로젝트 생성
2. **API 및 서비스 → 라이브러리** → `Gmail API` 검색 → 활성화
3. **OAuth 동의 화면** → 외부 선택 → 테스트 사용자에 `erudite.gun@gmail.com` 추가
4. **사용자 인증 정보 → OAuth 2.0 클라이언트 ID 만들기**
   - 애플리케이션 유형: **데스크톱 앱**
   - `client_id` 와 `client_secret` 복사

### 2-2. Refresh Token 발급 (로컬에서 1회 실행)

```bash
cd ~/Downloads/blog-automation
python get_google_token.py \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET
```

- 브라우저에서 Google 계정 인증 진행
- 터미널에 `GOOGLE_REFRESH_TOKEN` 출력됨 → 복사해서 보관

---

## Step 3: GitHub Secrets 등록

https://github.com/corbinkim/corbinkim.github.io/settings/secrets/actions 에서
아래 시크릿을 모두 추가:

| Secret 이름 | 설명 | 필요한 워크플로우 |
|---|---|---|
| `NOTION_TOKEN` | Notion Integration Token (`secret_...`) | 전체 |
| `TICKTICK_ACCESS_TOKEN` | TickTick OAuth access token | daily-briefing, weekly-review |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | gmail-triage |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 | gmail-triage |
| `GOOGLE_REFRESH_TOKEN` | get_google_token.py로 발급한 토큰 | gmail-triage |

> **TICKTICK_ACCESS_TOKEN 확인 방법:**
> `~/Downloads/ticktick-mcp/.env` 파일에서 `TICKTICK_ACCESS_TOKEN` 값 복사

---

## Step 4: 파일 복사 및 push

```bash
cd /Users/corbin/블로그/CorbinKim.github.io

# blog-automation 폴더에서 파일 복사
cp ~/Downloads/blog-automation/arxiv_digest.py .
cp ~/Downloads/blog-automation/conference_deadlines.py .
cp ~/Downloads/blog-automation/daily_briefing.py .
cp ~/Downloads/blog-automation/weekly_review.py .
cp ~/Downloads/blog-automation/gmail_triage.py .

mkdir -p .github/workflows
cp ~/Downloads/blog-automation/.github/workflows/*.yml .github/workflows/

git add .
git commit -m "Add GitHub Actions: full researcher automation suite"
git push
```

---

## Step 5: 수동 테스트

1. https://github.com/corbinkim/corbinkim.github.io/actions 접속
2. 각 워크플로우 → **"Run workflow"** 클릭해서 테스트
3. 실행 로그에서 에러 없는지 확인
4. Notion Academic Planner에 페이지가 생성됐는지 확인 ✅

---

## 자동화 스케줄 전체 요약

| 워크플로우 | KST 실행 시간 | 결과물 | 필요 Secrets |
|---|---|---|---|
| 📚 arXiv Daily Digest | 매일 09:00 | Notion Reading List에 논문 추가 | NOTION_TOKEN |
| 📋 Daily Briefing | 매일 08:00 | Notion 데일리 브리핑 페이지 | NOTION_TOKEN, TICKTICK_ACCESS_TOKEN |
| 📬 Gmail Triage | 매일 08:30 | Notion Gmail 트리아지 페이지 | NOTION_TOKEN, GOOGLE_* |
| 📅 Conference Deadlines | 매주 월 10:00 | GitHub Actions 요약 + .ics 아티팩트 | (없음) |
| 📊 Weekly Review | 매주 일 20:00 | Notion 주간 리뷰 페이지 | NOTION_TOKEN, TICKTICK_ACCESS_TOKEN |

---

## conference_deadlines.py 데드라인 업데이트 방법

`KNOWN_DEADLINES` 리스트를 직접 수정하세요:

```python
KNOWN_DEADLINES = [
    {"conf": "IEEE Globecom 2026", "date": date(2026, 4, 1), "tier": "A", "url": "..."},
    # 새 학회 추가
]
```

---

## 블로그 iCloud 심볼릭 링크 (선택사항)

블로그 레포를 iCloud에서 접근하고 싶다면:

```bash
ln -s "/Users/corbin/블로그/CorbinKim.github.io" \
  ~/Library/Mobile\ Documents/com~apple~CloudDocs/CorbinKim.github.io
```
