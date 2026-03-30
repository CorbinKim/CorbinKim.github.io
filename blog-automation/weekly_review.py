#!/usr/bin/env python3
"""
Weekly Research Review — 매주 일요일 오후 8시 KST
TickTick 이번 주 완료 태스크 + Notion Paper Reviews → Notion 주간 리뷰 페이지 생성
"""

import os, json, urllib.request
from datetime import datetime, date, timezone, timedelta

NOTION_TOKEN      = os.environ["NOTION_TOKEN"]
TICKTICK_TOKEN    = os.environ["TICKTICK_ACCESS_TOKEN"]
NOTION_PLANNER_ID = "2f37d5cddea18106af19d9d701498d65"
PAPER_REVIEWS_DB  = "049b39e90b6543ae97489bb59c364b62"
READING_LIST_DB   = "2f37d5cddea181debe26dbb42255c6b6"

TICKTICK_PROJECTS = [
    ("💻 Work",          "66713345300e911d2b8984e3"),
    ("📈 Side Projects", "66713375103a911d2b898506"),
    ("🤙🏻 Ritual",       "66afa11170add103a2747d2c"),
]

KST = timezone(timedelta(hours=9))


def ticktick_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.ticktick.com/open/v1{path}",
        headers={"Authorization": f"Bearer {TICKTICK_TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def notion_post(endpoint: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"https://api.notion.com/v1{endpoint}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {NOTION_TOKEN}",
                 "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def get_week_range() -> tuple[date, date]:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def get_completed_tasks(monday: date, sunday: date) -> list[dict]:
    """이번 주 완료된 TickTick 태스크"""
    tasks = []
    for proj_name, pid in TICKTICK_PROJECTS:
        try:
            data = ticktick_get(f"/project/{pid}/closed?from={monday}&to={sunday}&limit=30")
            for t in (data if isinstance(data, list) else data.get("tasks", [])):
                if t.get("status") == 2:  # completed
                    tasks.append({"project": proj_name, "title": t.get("title", "")})
        except Exception as e:
            print(f"  TickTick 완료 태스크 오류 ({proj_name}): {e}")
    return tasks


def get_week_paper_reviews(monday: date) -> list[dict]:
    """이번 주 리뷰된 논문"""
    data = notion_post(f"/databases/{PAPER_REVIEWS_DB}/query", {
        "filter": {
            "and": [
                {"property": "Status", "select": {"equals": "✅ Reviewed"}},
                {"timestamp": "created_time", "created_time": {"on_or_after": monday.isoformat()}},
            ]
        }, "page_size": 20,
    })
    reviews = []
    for p in data.get("results", []):
        props = p["properties"]
        title = props.get("Paper Title", {}).get("title", [])
        status = (props.get("Status", {}).get("select") or {}).get("name", "")
        reviews.append({
            "title":  title[0]["plain_text"] if title else "제목 없음",
            "status": status,
        })
    return reviews


def get_week_read_papers(monday: date) -> list[str]:
    """이번 주 읽은 논문 (Reading List)"""
    data = notion_post(f"/databases/{READING_LIST_DB}/query", {
        "filter": {
            "and": [
                {"property": "Status", "select": {"equals": "✅ Read"}},
                {"timestamp": "created_time", "created_time": {"on_or_after": monday.isoformat()}},
            ]
        }, "page_size": 20,
    })
    papers = []
    for p in data.get("results", []):
        title = p["properties"].get("Title", {}).get("title", [])
        papers.append(title[0]["plain_text"] if title else "제목 없음")
    return papers


def build_review_blocks(monday, sunday, tasks, reviews, read_papers) -> list:
    blocks = []

    def h2(text): return {"object": "block", "type": "heading_2",
        "heading_2": {"rich_text": [{"type": "text", "text": {"content": text}}]}}
    def bullet(text): return {"object": "block", "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": text}}]}}
    def para(text): return {"object": "block", "type": "paragraph",
        "paragraph": {"rich_text": [{"type": "text", "text": {"content": text}}]}}

    # 완료 태스크
    blocks.append(h2(f"✅ 이번 주 완료한 일 ({len(tasks)}개)"))
    if tasks:
        for t in tasks:
            blocks.append(bullet(f"[{t['project']}] {t['title']}"))
    else:
        blocks.append(para("이번 주 완료한 태스크 없음"))

    # 논문 리뷰
    blocks.append(h2(f"✍️ 작성한 논문 리뷰 ({len(reviews)}개)"))
    if reviews:
        for r in reviews:
            blocks.append(bullet(r["title"]))
    else:
        blocks.append(para("이번 주 리뷰 없음"))

    # 읽은 논문
    blocks.append(h2(f"📚 읽은 논문 ({len(read_papers)}개)"))
    if read_papers:
        for p in read_papers:
            blocks.append(bullet(p))
    else:
        blocks.append(para("이번 주 읽은 논문 없음"))

    # 다음 주 계획
    blocks.append(h2("🔜 다음 주 계획"))
    blocks.append(para("(직접 작성)"))

    # 회고
    blocks.append(h2("💭 한 줄 회고"))
    blocks.append(para("(직접 작성)"))

    return blocks


def main():
    now    = datetime.now(KST)
    monday, sunday = get_week_range()
    print(f"📊 Weekly Review 생성 중 — {monday} ~ {sunday}\n")

    tasks        = get_completed_tasks(monday, sunday)
    reviews      = get_week_paper_reviews(monday)
    read_papers  = get_week_read_papers(monday)

    print(f"  완료 태스크:   {len(tasks)}개")
    print(f"  논문 리뷰:     {len(reviews)}개")
    print(f"  읽은 논문:     {len(read_papers)}개\n")

    week_label = f"{monday.strftime('%m/%d')}–{sunday.strftime('%m/%d')}"
    payload = {
        "parent": {"page_id": NOTION_PLANNER_ID},
        "properties": {"title": {"title": [{"text": {
            "content": f"📊 Weekly Review — {monday.strftime('%Y')} W{monday.isocalendar()[1]} ({week_label})"
        }}]}},
        "children": build_review_blocks(monday, sunday, tasks, reviews, read_papers),
    }
    result = notion_post("/pages", payload)
    url = result.get("url", "")
    print(f"✅ Notion 주간 리뷰 페이지 생성 완료")
    print(f"   {url}")

    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(f"## 📊 Weekly Review — {week_label}\n")
            f.write(f"- 완료 태스크: {len(tasks)}개\n")
            f.write(f"- 논문 리뷰: {len(reviews)}개\n")
            f.write(f"- 읽은 논문: {len(read_papers)}개\n")
            f.write(f"- [Notion에서 보기]({url})\n")


if __name__ == "__main__":
    main()
