#!/usr/bin/env python3
"""
Gmail Research Triage — 매일 오전 8:30 KST
중요 이메일(논문 알림, 학회, 지도교수, 공동연구자) 분류 → Notion 페이지 생성
Google OAuth2 refresh token으로 인증 (GitHub Secrets에 저장)
"""

import os, json, base64, urllib.request, urllib.parse
from datetime import datetime, timezone, timedelta

# ── 환경 변수 ────────────────────────────────────────────────────────
NOTION_TOKEN       = os.environ["NOTION_TOKEN"]
GOOGLE_CLIENT_ID   = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
GOOGLE_REFRESH_TOKEN = os.environ["GOOGLE_REFRESH_TOKEN"]
NOTION_PLANNER_ID  = "2f37d5cddea18106af19d9d701498d65"

KST = timezone(timedelta(hours=9))

# ── 분류 키워드 ───────────────────────────────────────────────────────
CATEGORIES = {
    "📄 논문/리뷰":    ["review", "submission", "accept", "reject", "revision", "camera ready",
                       "paper", "manuscript", "arxiv"],
    "📅 학회/데드라인": ["deadline", "CFP", "call for paper", "workshop", "symposium",
                       "conference", "globecom", "infocom", "mobicom", "sigcomm", "icc", "wcnc"],
    "👨‍🏫 지도교수/연구실": ["prof", "professor", "advisor", "lab meeting", "nextg", "ncsu"],
    "🤝 공동연구":     ["collaboration", "co-author", "joint", "partner", "collaborate"],
    "🏛️ 학교 행정":    ["registrar", "graduate school", "tuition", "enrollment", "ncsu.edu"],
}


# ── Google OAuth2 ─────────────────────────────────────────────────────
def get_access_token() -> str:
    """refresh_token으로 새 access_token 발급"""
    payload = urllib.parse.urlencode({
        "client_id":     GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": GOOGLE_REFRESH_TOKEN,
        "grant_type":    "refresh_token",
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())["access_token"]


# ── Gmail API ─────────────────────────────────────────────────────────
def gmail_get(path: str, access_token: str) -> dict:
    req = urllib.request.Request(
        f"https://gmail.googleapis.com/gmail/v1{path}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def get_unread_messages(access_token: str) -> list[dict]:
    """오늘 받은 읽지 않은 메일 목록"""
    today = datetime.now(KST).strftime("%Y/%m/%d")
    query = urllib.parse.quote(f"is:unread after:{today}")
    data = gmail_get(f"/users/me/messages?q={query}&maxResults=30", access_token)
    messages = []
    for m in data.get("messages", []):
        msg = gmail_get(f"/users/me/messages/{m['id']}?format=metadata"
                        "&metadataHeaders=Subject&metadataHeaders=From", access_token)
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        messages.append({
            "id":      m["id"],
            "subject": headers.get("Subject", "(제목 없음)"),
            "from":    headers.get("From", ""),
            "snippet": msg.get("snippet", ""),
        })
    return messages


def categorize(msg: dict) -> str:
    text = (msg["subject"] + " " + msg["from"] + " " + msg["snippet"]).lower()
    for cat, keywords in CATEGORIES.items():
        if any(kw.lower() in text for kw in keywords):
            return cat
    return "📬 기타"


# ── Notion ────────────────────────────────────────────────────────────
def notion_post(endpoint: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"https://api.notion.com/v1{endpoint}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization":  f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type":   "application/json",
        }, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def build_triage_blocks(categorized: dict[str, list], total: int) -> list:
    blocks = []

    def h2(text): return {"object": "block", "type": "heading_2",
        "heading_2": {"rich_text": [{"type": "text", "text": {"content": text}}]}}
    def bullet(text): return {"object": "block", "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": text}}]}}
    def para(text): return {"object": "block", "type": "paragraph",
        "paragraph": {"rich_text": [{"type": "text", "text": {"content": text}}]}}

    blocks.append(para(f"총 읽지 않은 메일: {total}개"))

    for cat in ["📄 논문/리뷰", "📅 학회/데드라인", "👨‍🏫 지도교수/연구실",
                "🤝 공동연구", "🏛️ 학교 행정", "📬 기타"]:
        msgs = categorized.get(cat, [])
        if not msgs:
            continue
        blocks.append(h2(f"{cat} ({len(msgs)}개)"))
        for m in msgs:
            sender = m["from"].split("<")[0].strip()
            blocks.append(bullet(f"{m['subject']} — {sender}"))

    if not any(categorized.values()):
        blocks.append(para("오늘 읽지 않은 메일 없음 🎉"))

    return blocks


def main():
    now = datetime.now(KST)
    print(f"📬 Gmail Triage 실행 중 — {now.strftime('%Y-%m-%d %H:%M KST')}\n")

    access_token = get_access_token()
    messages = get_unread_messages(access_token)
    print(f"  읽지 않은 메일: {len(messages)}개")

    categorized: dict[str, list] = {}
    for m in messages:
        cat = categorize(m)
        categorized.setdefault(cat, []).append(m)

    for cat, msgs in categorized.items():
        print(f"  {cat}: {len(msgs)}개")

    date_str = now.strftime("%Y-%m-%d (%a)")
    payload = {
        "parent": {"page_id": NOTION_PLANNER_ID},
        "properties": {"title": {"title": [{"text": {
            "content": f"📬 Gmail Triage — {date_str}"
        }}]}},
        "children": build_triage_blocks(categorized, len(messages)),
    }
    result = notion_post("/pages", payload)
    url = result.get("url", "")
    print(f"\n✅ Notion 트리아지 페이지 생성 완료")
    print(f"   {url}")

    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(f"## 📬 Gmail Triage — {now.strftime('%Y-%m-%d')}\n")
            f.write(f"- 읽지 않은 메일: {len(messages)}개\n")
            for cat, msgs in categorized.items():
                f.write(f"- {cat}: {len(msgs)}개\n")
            f.write(f"- [Notion에서 보기]({url})\n")


if __name__ == "__main__":
    main()
