#!/usr/bin/env python3
"""
Notion Paper Reviews → Jekyll Blog Post 자동 발행기

동작:
  1. Notion Paper Reviews DB에서 Status = "✅ Reviewed" AND Blog Post = false 항목 조회
  2. Jekyll Markdown 포스트 생성 (paper/_posts/YYYY-MM-DD-slug.md)
  3. Notion 항목 업데이트: Status → "🚀 Published", Blog Post → true

실행:
  python3 blog_publisher.py
  python3 blog_publisher.py --dry-run   # 미리보기 (파일 생성 + Notion 업데이트 없음)

환경 변수:
  NOTION_TOKEN          : Notion Integration Token
  BLOG_REPO_PATH        : Jekyll 블로그 루트 경로 (기본: ~/블로그/CorbinKim.github.io)
"""

import os, re, json, argparse, urllib.request, urllib.error
from datetime import date, datetime
from pathlib import Path

# ── 설정 ──────────────────────────────────────────────────────────────────────
NOTION_TOKEN    = os.environ.get("NOTION_TOKEN", "")
PAPER_REVIEWS_DB = "049b39e90b6543ae97489bb59c364b62"
BLOG_REPO_PATH   = Path(os.environ.get("BLOG_REPO_PATH",
                         str(Path.home() / "블로그" / "CorbinKim.github.io")))
POSTS_DIR        = BLOG_REPO_PATH / "paper" / "_posts"

NOTION_VERSION   = "2022-06-28"
BASE_URL         = "https://api.notion.com/v1"


# ── Notion API 헬퍼 ───────────────────────────────────────────────────────────
def notion_request(method: str, path: str, body=None):
    url  = f"{BASE_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {NOTION_TOKEN}")
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  Notion API error {e.code}: {e.read().decode()}")
        return None


def query_reviews():
    """Status = ✅ Reviewed AND Blog Post checkbox = false 인 항목 반환"""
    body = {
        "filter": {
            "and": [
                {"property": "Status",    "select":   {"equals": "✅ Reviewed"}},
                {"property": "Blog Post", "checkbox": {"equals": False}},
            ]
        },
        "sorts": [{"property": "Date Read", "direction": "descending"}]
    }
    result = notion_request("POST", f"/databases/{PAPER_REVIEWS_DB}/query", body)
    return result.get("results", []) if result else []


def get_text(prop) -> str:
    """Notion 텍스트 속성에서 plain_text 추출"""
    if not prop:
        return ""
    rt = prop.get("rich_text") or prop.get("title") or []
    return "".join(t.get("plain_text", "") for t in rt).strip()


def get_select(prop) -> str:
    if not prop:
        return ""
    s = prop.get("select")
    return s.get("name", "") if s else ""


def get_multiselect(prop) -> list:
    if not prop:
        return []
    return [t.get("name", "") for t in (prop.get("multi_select") or [])]


def get_url(prop) -> str:
    if not prop:
        return ""
    return prop.get("url") or ""


def get_number(prop) -> str:
    if not prop:
        return ""
    n = prop.get("number")
    return str(n) if n is not None else ""


def get_date(prop) -> str:
    if not prop:
        return ""
    d = prop.get("date")
    return d.get("start", "") if d else ""


def get_checkbox(prop) -> bool:
    if not prop:
        return False
    return bool(prop.get("checkbox"))


# ── Slug 생성 ──────────────────────────────────────────────────────────────────
def slugify(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:80].strip("-")


# ── Jekyll Front-matter + 본문 생성 ───────────────────────────────────────────
RATING_MAP = {
    "⭐":     1,
    "⭐⭐":   2,
    "⭐⭐⭐": 3,
    "⭐⭐⭐⭐":   4,
    "⭐⭐⭐⭐⭐": 5,
}

def stars_to_int(rating: str) -> int:
    # Count actual star characters
    return rating.count("⭐") if rating else 0


def generate_markdown(page: dict) -> tuple:
    """(filename, markdown_content) 반환"""
    props = page.get("properties", {})

    title        = get_text(props.get("Paper Title"))
    summary      = get_text(props.get("Summary"))
    contributions = get_text(props.get("Key Contributions"))
    methodology  = get_text(props.get("Methodology"))
    results      = get_text(props.get("Results"))
    opinion      = get_text(props.get("My Opinion"))
    authors      = get_text(props.get("Authors"))
    arxiv_url    = get_url(props.get("ArXiv URL"))
    tags         = get_multiselect(props.get("Tags"))
    venue        = get_select(props.get("Venue"))
    rating_str   = get_select(props.get("Rating"))
    year         = get_number(props.get("Year"))
    date_read    = get_date(props.get("Date Read")) or date.today().isoformat()

    # 파일명: YYYY-MM-DD-slug.md
    post_date = date_read[:10] if date_read else date.today().isoformat()
    slug      = slugify(title) if title else "untitled"
    filename  = f"{post_date}-{slug}.md"

    # tags → Jekyll 형식 (리스트)
    tag_list = "\n".join(f"  - {t}" for t in tags) if tags else "  - paper"

    # rating 숫자 (0–5)
    rating_int = stars_to_int(rating_str)
    rating_display = rating_str or "N/A"

    # arXiv ID 추출 (있으면)
    arxiv_id = ""
    if arxiv_url:
        m = re.search(r"arxiv\.org/abs/(\d{4}\.\d{4,5})", arxiv_url)
        if m:
            arxiv_id = m.group(1)

    # description (요약 첫 문장)
    description = ""
    if summary:
        first = summary.split(".")[0].strip()
        description = first[:200] if len(first) < 200 else first[:200] + "..."

    # Front-matter
    front_matter = f"""---
layout: paper
title: "{title.replace('"', "'")}"
date: {post_date}
categories: [paper-review]
tags:
{tag_list}
authors: "{authors}"
venue: "{venue}"
year: {year or '""'}
arxiv: "{arxiv_id}"
arxiv_url: "{arxiv_url}"
rating: {rating_int}
rating_display: "{rating_display}"
description: "{description.replace('"', "'")}"
---
"""

    # 본문
    def section(heading: str, content: str) -> str:
        if not content:
            return ""
        return f"\n## {heading}\n\n{content}\n"

    body = f"# {title}\n"
    body += f"\n> **Authors**: {authors}  \n> **Venue**: {venue}  \n> **Year**: {year}  \n> **Rating**: {rating_display}\n"
    if arxiv_url:
        body += f"> **ArXiv**: [{arxiv_id or arxiv_url}]({arxiv_url})\n"
    body += section("Summary", summary)
    body += section("Key Contributions", contributions)
    body += section("Methodology", methodology)
    body += section("Results & Evaluation", results)
    body += section("My Opinion", opinion)
    body += "\n---\n*This post was auto-generated from my Notion Paper Reviews.*\n"

    return filename, front_matter + body


# ── Notion 업데이트 ────────────────────────────────────────────────────────────
def mark_published(page_id: str):
    body = {
        "properties": {
            "Status":    {"select":   {"name": "🚀 Published"}},
            "Blog Post": {"checkbox": True},
        }
    }
    notion_request("PATCH", f"/pages/{page_id}", body)


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="실제 변경 없이 미리보기")
    args = parser.parse_args()

    if not NOTION_TOKEN:
        print("❌ NOTION_TOKEN 환경 변수가 없습니다.")
        return

    print(f"📚 Notion Paper Reviews 조회 중...")
    pages = query_reviews()
    print(f"   발행 대기: {len(pages)}개\n")

    if not pages:
        print("✅ 발행할 논문이 없습니다.")
        return

    if args.dry_run:
        print("[ DRY RUN — 파일/Notion 변경 없음 ]\n")

    published = []
    failed    = []

    for page in pages:
        props    = page.get("properties", {})
        title    = get_text(props.get("Paper Title")) or "(제목 없음)"
        page_id  = page["id"]

        print(f"  📄 {title[:65]}")

        try:
            filename, content = generate_markdown(page)
            post_path = POSTS_DIR / filename
            print(f"     → {post_path.relative_to(BLOG_REPO_PATH)}")

            if not args.dry_run:
                POSTS_DIR.mkdir(parents=True, exist_ok=True)
                post_path.write_text(content, encoding="utf-8")
                mark_published(page_id)
                print(f"     ✅ 파일 생성 + Notion 업데이트 완료")
            else:
                print(f"     [DRY RUN] 파일 생성 예정")
                print(f"     --- 미리보기 ---")
                print(content[:400] + "\n     ...")

            published.append(filename)

        except Exception as e:
            print(f"     ❌ 오류: {e}")
            failed.append(title)

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}✅ 완료: {len(published)}개 발행 / ❌ 실패: {len(failed)}개")

    if published and not args.dry_run:
        print("\n📌 이제 블로그 레포에서 git push 하세요:")
        print(f"   cd {BLOG_REPO_PATH}")
        print(f"   git add paper/_posts/")
        print(f"   git commit -m 'Add {len(published)} paper review(s)'")
        print(f"   git push")


if __name__ == "__main__":
    main()
