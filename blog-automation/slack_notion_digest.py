"""
slack_notion_digest.py — Slack 채널 요약 → Notion Inbox DB

기존: Academic Planner에 standalone 페이지 생성
신규: Inbox DB에 Source=Slack으로 항목 생성

Cowork 스케줄 태스크 또는 직접 실행 모두 지원.

환경 변수:
  NOTION_TOKEN  : Notion integration token
  SLACK_TOKEN   : Slack Bot OAuth token (xoxb-...)
  SLACK_CHANNELS: 쉼표 구분 채널 ID 목록 (기본: 연구실 채널들)
"""

import os
import sys
import json
import datetime
import requests

# ── 상수 ─────────────────────────────────────────────────────────────────────
NOTION_TOKEN    = os.environ.get("NOTION_TOKEN", "")
SLACK_TOKEN     = os.environ.get("SLACK_TOKEN", "")
INBOX_DB_ID     = "9d1d2395afe64a86bb5abc4a5920c213"
NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION  = "2022-06-28"
SLACK_API_BASE  = "https://slack.com/api"

# 기본 채널 ID는 실제 Slack 채널 ID로 교체 필요
DEFAULT_CHANNELS = os.environ.get("SLACK_CHANNELS", "").split(",")
HOURS_BACK       = 24   # 최근 N시간 메시지

NOTION_HEADERS = {
    "Authorization":  f"Bearer {NOTION_TOKEN}",
    "Content-Type":   "application/json",
    "Notion-Version": NOTION_VERSION,
}

SLACK_HEADERS = {
    "Authorization": f"Bearer {SLACK_TOKEN}",
    "Content-Type":  "application/json; charset=utf-8",
}

# ── Slack 메시지 수집 ─────────────────────────────────────────────────────────
def fetch_slack_messages(channel_id: str, oldest_ts: float) -> list[dict]:
    url    = f"{SLACK_API_BASE}/conversations.history"
    params = {
        "channel":  channel_id,
        "oldest":   str(oldest_ts),
        "limit":    100,
        "inclusive": True,
    }
    res  = requests.get(url, headers=SLACK_HEADERS, params=params, timeout=15)
    data = res.json()
    if not data.get("ok"):
        print(f"[WARN] Slack API 오류 ({channel_id}): {data.get('error')}")
        return []
    return data.get("messages", [])


def get_channel_name(channel_id: str) -> str:
    url    = f"{SLACK_API_BASE}/conversations.info"
    params = {"channel": channel_id}
    res    = requests.get(url, headers=SLACK_HEADERS, params=params, timeout=10)
    data   = res.json()
    return data.get("channel", {}).get("name", channel_id)


def categorize_messages(messages: list[dict]) -> dict[str, list[str]]:
    """메시지를 공지/연구/일정/기타로 분류합니다."""
    categories = {"공지": [], "연구": [], "일정": [], "기타": []}

    ANNOUNCEMENT_KEYWORDS = ["공지", "안내", "notice", "announcement", "중요"]
    RESEARCH_KEYWORDS     = ["논문", "paper", "arXiv", "결과", "실험", "모델", "코드"]
    SCHEDULE_KEYWORDS     = ["미팅", "meeting", "일정", "deadline", "마감", "세미나"]

    for msg in messages:
        text = msg.get("text", "").lower()
        if not text or msg.get("subtype"):  # 봇 메시지·시스템 메시지 제외
            continue

        snippet = msg.get("text", "")[:120].replace("\n", " ")

        if any(k in text for k in ANNOUNCEMENT_KEYWORDS):
            categories["공지"].append(snippet)
        elif any(k in text for k in RESEARCH_KEYWORDS):
            categories["연구"].append(snippet)
        elif any(k in text for k in SCHEDULE_KEYWORDS):
            categories["일정"].append(snippet)
        else:
            categories["기타"].append(snippet)

    return categories


def build_summary(channel_summaries: list[dict]) -> str:
    """채널별 요약을 하나의 텍스트로 병합합니다."""
    parts = []
    for ch in channel_summaries:
        name   = ch["name"]
        cats   = ch["categories"]
        total  = sum(len(v) for v in cats.values())
        if total == 0:
            continue

        lines = [f"[#{name}] {total}개 메시지"]
        for cat, msgs in cats.items():
            if msgs:
                lines.append(f"  {cat} ({len(msgs)})")
                for m in msgs[:3]:  # 카테고리당 최대 3개 미리보기
                    lines.append(f"    · {m}")
        parts.append("\n".join(lines))

    return "\n\n".join(parts) if parts else "새 메시지 없음"


# ── Notion Inbox DB에 항목 생성 ───────────────────────────────────────────────
def create_inbox_entry(title: str, date_str: str, summary: str) -> bool:
    url = f"{NOTION_API_BASE}/pages"
    payload = {
        "parent": {"database_id": INBOX_DB_ID},
        "properties": {
            "Title":   {"title":     [{"text": {"content": title}}]},
            "Date":    {"date":      {"start": date_str}},
            "Source":  {"select":    {"name": "Slack"}},
            "Status":  {"select":    {"name": "New"}},
            "Summary": {"rich_text": [{"text": {"content": summary[:2000]}}]},
        },
    }
    res = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=15)
    if res.status_code == 200:
        print(f"✅ Inbox 항목 생성: {title}")
        return True
    else:
        print(f"❌ 생성 실패 ({res.status_code}): {res.text}")
        return False


def digest_exists_today(date_str: str) -> bool:
    url = f"{NOTION_API_BASE}/databases/{INBOX_DB_ID}/query"
    payload = {
        "filter": {
            "and": [
                {"property": "Source", "select": {"equals": "Slack"}},
                {"property": "Date",   "date":   {"equals": date_str}},
            ]
        },
        "page_size": 1,
    }
    try:
        res  = requests.post(url, headers=NOTION_HEADERS, json=payload, timeout=15)
        data = res.json()
        return len(data.get("results", [])) > 0
    except Exception:
        return False


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    if not NOTION_TOKEN:
        print("❌ NOTION_TOKEN이 설정되지 않았습니다.")
        sys.exit(1)
    if not SLACK_TOKEN:
        print("❌ SLACK_TOKEN이 설정되지 않았습니다.")
        sys.exit(1)

    channels = [c.strip() for c in DEFAULT_CHANNELS if c.strip()]
    if not channels:
        print("❌ SLACK_CHANNELS 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    today    = datetime.date.today()
    weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_str  = weekdays[today.weekday()]
    date_str = today.strftime("%Y-%m-%d")
    title    = f"💬 Slack Digest — {date_str} ({day_str})"

    if digest_exists_today(date_str):
        print(f"⏭  오늘 Slack 다이제스트가 이미 존재합니다: {date_str}")
        sys.exit(0)

    import time
    oldest_ts = time.time() - HOURS_BACK * 3600

    channel_summaries = []
    for ch_id in channels:
        name     = get_channel_name(ch_id)
        messages = fetch_slack_messages(ch_id, oldest_ts)
        cats     = categorize_messages(messages)
        channel_summaries.append({"name": name, "categories": cats})
        print(f"  #{name}: {sum(len(v) for v in cats.values())}개 메시지")

    summary = build_summary(channel_summaries)
    success = create_inbox_entry(title=title, date_str=date_str, summary=summary)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
