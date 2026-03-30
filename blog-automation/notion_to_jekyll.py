#!/usr/bin/env python3
"""
Notion Paper Review → Jekyll Blog Post 변환기
사용법: python3 notion_to_jekyll.py
       (Reviewed 상태의 논문들을 Jekyll .md 파일로 변환해 blog-posts/ 폴더에 저장)
"""

import os
import re
import json
import requests
from datetime import datetime
from pathlib import Path

# ─── 설정 ───────────────────────────────────────────────
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")  # Notion Integration Token
DATABASE_ID  = "049b39e90b6543ae97489bb59c364b62"   # Paper Reviews DB ID
OUTPUT_DIR   = Path(__file__).parent / "blog-posts"  # 생성된 .md 저장 위치
# ────────────────────────────────────────────────────────

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}


def get_reviewed_papers():
    """Notion DB에서 '✅ Reviewed' 상태이고 Blog Post가 False인 논문 조회"""
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {
        "filter": {
            "and": [
                {"property": "Status", "select": {"equals": "✅ Reviewed"}},
                {"property": "Blog Post", "checkbox": {"equals": False}},
            ]
        }
    }
    res = requests.post(url, headers=HEADERS, json=payload)
    res.raise_for_status()
    return res.json().get("results", [])


def extract_text(rich_text_list):
    """Notion rich_text 배열 → 일반 문자열"""
    return "".join(t.get("plain_text", "") for t in (rich_text_list or []))


def slugify(title):
    """제목 → URL-friendly 슬러그"""
    slug = title.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:80]


def generate_front_matter(props, date_str):
    """Hydejack 테마용 Jekyll front matter 생성"""
    title   = extract_text(props.get("Paper Title", {}).get("title", []))
    authors = extract_text(props.get("Authors", {}).get("rich_text", []))
    venue   = (props.get("Venue", {}).get("select") or {}).get("name", "")
    year    = int((props.get("Year", {}).get("number") or 0))
    tags    = [t["name"] for t in (props.get("Tags", {}).get("multi_select") or [])]
    rating  = (props.get("Rating", {}).get("select") or {}).get("name", "")
    arxiv   = (props.get("ArXiv URL", {}).get("url") or "")

    tag_str  = ", ".join(f"[{t}]" for t in tags) if tags else ""
    desc_str = f"**Venue**: {venue} {year}  <br> **Tags**: {tag_str}  <br> **Rating**: {rating}"

    fm = f"""---
layout: post
title: "{title}"
description: >
  {desc_str}
date: {date_str}
sitemap: true
hide_last_modified: true
"""
    if arxiv:
        fm += f'arxiv: "{arxiv}"\n'
    fm += "---\n"
    return fm, title, authors


def generate_body(props):
    """논문 리뷰 본문 생성"""
    summary       = extract_text(props.get("Summary",          {}).get("rich_text", []))
    contributions = extract_text(props.get("Key Contributions",{}).get("rich_text", []))
    methodology   = extract_text(props.get("Methodology",      {}).get("rich_text", []))
    results       = extract_text(props.get("Results",          {}).get("rich_text", []))
    opinion       = extract_text(props.get("My Opinion",       {}).get("rich_text", []))

    body = "* toc\n{:toc}\n\n---\n\n"

    if summary:
        body += f"## Abstract\n\n{summary}\n\n---\n\n"
    if contributions:
        body += f"## Key Contributions\n\n{contributions}\n\n---\n\n"
    if methodology:
        body += f"## Methodology\n\n{methodology}\n\n---\n\n"
    if results:
        body += f"## Results\n\n{results}\n\n---\n\n"
    if opinion:
        body += f"## Take Away\n\n{opinion}\n\n"

    return body


def mark_as_published(page_id):
    """Notion에서 해당 논문의 Blog Post 체크박스를 True로 업데이트"""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    payload = {"properties": {"Blog Post": {"checkbox": True}}}
    res = requests.patch(url, headers=HEADERS, json=payload)
    res.raise_for_status()


def main():
    if not NOTION_TOKEN:
        print("❌ NOTION_TOKEN 환경변수를 설정해주세요")
        print("   export NOTION_TOKEN='secret_...'")
        return

    OUTPUT_DIR.mkdir(exist_ok=True)
    papers = get_reviewed_papers()

    if not papers:
        print("✅ 새로 게시할 논문 리뷰가 없습니다 (Reviewed 상태 + Blog Post 미체크)")
        return

    print(f"📄 {len(papers)}개의 논문 리뷰를 변환합니다...\n")

    for paper in papers:
        props   = paper["properties"]
        page_id = paper["id"]
        today   = datetime.now().strftime("%Y-%m-%d")

        fm, title, authors = generate_front_matter(props, today)
        body     = generate_body(props)
        content  = fm + "\n" + body
        slug     = slugify(title) if title else page_id
        filename = f"{today}-{slug}.md"
        filepath = OUTPUT_DIR / filename

        filepath.write_text(content, encoding="utf-8")
        print(f"  ✅ {filename}")

        # Notion에서 Blog Post = True 로 업데이트
        mark_as_published(page_id)
        print(f"     └─ Notion '🚀 Published'로 업데이트 완료")

    print(f"\n📁 저장 위치: {OUTPUT_DIR.resolve()}")
    print("\n다음 단계:")
    print(f"  cp {OUTPUT_DIR}/*.md ~/corbinkim.github.io/paper/_posts/")
    print("  cd ~/corbinkim.github.io && git add . && git commit -m 'Add paper reviews' && git push")


if __name__ == "__main__":
    main()
