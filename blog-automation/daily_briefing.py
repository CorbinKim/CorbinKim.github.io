"""
daily_briefing.py — GitHub Actions 데일리 브리핑 → Notion Inbox DB

기존: Academic Planner에 standalone 페이지 생성
신규: Inbox DB에 Source=Briefing으로 단일 항목 생성 (Summary에 전체 내용)

GitHub Actions 환경 변수:
  NOTION_TOKEN  : Notion integration token
"""

import os
import sys
import json
import datetime
import requests

# ── 상수 ─────────────────────────────────────────────────────────────────────
NOTION_TOKEN      = os.environ.get("NOTION_TOKEN", "")
INBOX_DB_ID       = "9d1d2395afe64a86bb5abc4a5920c213"   # 📬 Inbox DB
NOTION_API_BASE   = "https://api.notion.com/v1"
NOTION_VERSION    = "2022-06-28"

HEADERS = {
    "Authorization":  f"Bearer {NOTION_TOKEN}",
    "Content-Type":   "application/json",
    "Notion-Version": NOTION_VERSION,
}

# ── GitHub Actions Workflow Summary 읽기 ─────────────────────────────────────
def get_workflow_summary() -> str:
    """
    GitHub Actions에서 실행 시 GITHUB_STEP_SUMMARY 환경변수를 통해
    워크플로우 요약을 가져옵니다.
    없으면 기본 메시지를 반환합니다.
    """
    summary_file = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary_file and os.path.exists(summary_file):
        with open(summary_file, "r") as f:
            return f.read().strip()
    return "(No summary available)"


def build_briefing_content() -> dict:
    """데일리 브리핑에 포함할 내용을 생성합니다."""
    today = datetime.date.today()
    weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_str   = weekdays[today.weekday()]
    date_str  = today.strftime("%Y-%m-%d")

    sections = []

    # 1. arXiv 논문 요약 (Reading List DB에서 오늘 추가된 항목 조회)
    arxiv_summary = get_todays_arxiv_papers(date_str)
    if arxiv_summary:
        sections.append(f"📚 **Today's Papers**\n{arxiv_summary}")

    # 2. 기본 브리핑 텍스트
    if not sections:
        sections.append("No new items today.")

    full_text = "\n\n".join(sections)

    return {
        "title": f"📋 Daily Briefing — {date_str} ({day_str})",
        "date":  date_str,
        "summary": full_text[:2000],  # Notion rich_text 한도
    }


def get_todays_arxiv_papers(date_str: str) -> str:
    """Reading List DB에서 오늘 추가된 논문 목록을 가져옵니다."""
    READING_LIST_DB = "2f37d5cddea181debe26dbb42255c6b6"
    url = f"{NOTION_API_BASE}/databases/{READING_LIST_DB}/query"

    payload = {
        "filter": {
            "property": "Added",
            "date": {"equals": date_str}
        },
        "page_size": 20,
    }

    try:
        res = requests.post(url, headers=HEADERS, json=payload, timeout=15)
        data = res.json()
        papers = []
        for page in data.get("results", []):
            props = page.get("properties", {})
            title_prop = props.get("Title", {}).get("title", [])
            title = title_prop[0]["plain_text"] if title_prop else "(untitled)"
            papers.append(f"  • {title}")
        return "\n".join(papers) if papers else ""
    except Exception as e:
        print(f"[WARN] Reading List 조회 실패: {e}")
        return ""


# ── Notion Inbox DB에 항목 생성 ───────────────────────────────────────────────
def create_inbox_entry(title: str, date_str: str, summary: str) -> bool:
    url = f"{NOTION_API_BASE}/pages"

    payload = {
        "parent": {"database_id": INBOX_DB_ID},
        "properties": {
            "Title":   {"title":     [{"text": {"content": title}}]},
            "Date":    {"date":      {"start": date_str}},
            "Source":  {"select":    {"name": "Briefing"}},
            "Status":  {"select":    {"name": "New"}},
            "Summary": {"rich_text": [{"text": {"content": summary}}]},
        },
    }

    res = requests.post(url, headers=HEADERS, json=payload, timeout=15)
    if res.status_code == 200:
        print(f"✅ Inbox 항목 생성: {title}")
        return True
    else:
        print(f"❌ 생성 실패 ({res.status_code}): {res.text}")
        return False


# ── 중복 방지: 오늘 브리핑이 이미 있으면 건너뜀 ────────────────────────────────
def briefing_exists_today(date_str: str) -> bool:
    url = f"{NOTION_API_BASE}/databases/{INBOX_DB_ID}/query"
    payload = {
        "filter": {
            "and": [
                {"property": "Source", "select":  {"equals": "Briefing"}},
                {"property": "Date",   "date":    {"equals": date_str}},
            ]
        },
        "page_size": 1,
    }
    try:
        res  = requests.post(url, headers=HEADERS, json=payload, timeout=15)
        data = res.json()
        return len(data.get("results", [])) > 0
    except Exception:
        return False


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    if not NOTION_TOKEN:
        print("❌ NOTION_TOKEN이 설정되지 않았습니다.")
        sys.exit(1)

    briefing = build_briefing_content()

    if briefing_exists_today(briefing["date"]):
        print(f"⏭  오늘 브리핑이 이미 존재합니다: {briefing['date']}")
        sys.exit(0)

    success = create_inbox_entry(
        title   = briefing["title"],
        date_str= briefing["date"],
        summary = briefing["summary"],
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
