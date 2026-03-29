#!/usr/bin/env python3
"""
arXiv Daily Digest → Notion Reading List
매일 통신 AI 관련 신규 논문을 arXiv에서 가져와 Notion Reading List에 추가합니다.
"""

import os
import time
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

# ── 설정 ──────────────────────────────────────────────
NOTION_TOKEN   = os.environ["NOTION_TOKEN"]
NOTION_DB_ID   = "2f37d5cddea181debe26dbb42255c6b6"  # 📚 Reading List DB
LOOKBACK_HOURS = 26  # 지난 N시간 내 논문만 수집 (여유 2시간)

# arXiv 검색 쿼리 (통신 AI 특화)
SEARCH_QUERIES = [
    # NTN (비지상네트워크)
    'cat:cs.NI AND (ti:"non-terrestrial" OR ti:NTN OR abs:"non-terrestrial network")',
    # LLM + 통신
    'cat:cs.NI AND (ti:LLM OR ti:"large language model" OR abs:"telecom" AND abs:"large language model")',
    # RAN / 네트워크 자원관리
    'cat:cs.NI AND (ti:"RAN slicing" OR ti:"resource management" OR ti:"network slicing")',
    # TelcoAgent / telecom AI agent
    '(ti:TelcoAgent OR abs:TelcoAgent OR (abs:"telecom" AND abs:"AI agent"))',
    # 트래픽 예측 / 기지국
    'cat:cs.NI AND (ti:"traffic prediction" OR ti:"base station" OR ti:"energy efficiency" AND abs:network)',
]

# Notion 태그 키워드 매핑
TAG_RULES = {
    "LLM":                ["llm", "large language model", "gpt", "bert", "transformer"],
    "NTN":                ["ntn", "non-terrestrial", "satellite", "uav", "leo", "meo"],
    "TelcoAgent":         ["telcoagent", "telecom agent", "telecom ai"],
    "Network":            ["network", "wireless", "cellular", "5g", "6g", "ran"],
    "RAG":                ["rag", "retrieval", "retrieval-augmented"],
    "Agent":              ["agent", "multi-agent", "autonomous"],
    "Resource Management":["resource management", "resource allocation", "scheduling"],
    "Traffic Prediction": ["traffic prediction", "traffic forecast", "load prediction"],
    "Energy Efficiency":  ["energy efficiency", "energy saving", "green network"],
    "Slicing":            ["slicing", "network slice", "ran slicing"],
    "Ontology":           ["ontology", "knowledge graph", "semantic"],
    "Survey":             ["survey", "review", "overview"],
}

ARXIV_NS = "http://www.w3.org/2005/Atom"


def search_arxiv(query: str, max_results: int = 8) -> list[dict]:
    """arXiv API로 논문 검색"""
    params = urllib.parse.urlencode({
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    })
    url = f"https://export.arxiv.org/api/query?{params}"

    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = resp.read()
        time.sleep(3)  # arXiv rate limit 준수
    except Exception as e:
        print(f"  arXiv 요청 실패: {e}")
        return []

    root = ET.fromstring(data)
    papers = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)

    for entry in root.findall(f"{{{ARXIV_NS}}}entry"):
        published_str = entry.findtext(f"{{{ARXIV_NS}}}published", "")
        try:
            published = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
        except Exception:
            continue

        if published < cutoff:
            continue

        arxiv_id = entry.findtext(f"{{{ARXIV_NS}}}id", "").strip()
        title    = entry.findtext(f"{{{ARXIV_NS}}}title", "").strip().replace("\n", " ")
        abstract = entry.findtext(f"{{{ARXIV_NS}}}summary", "").strip().replace("\n", " ")
        authors  = [a.findtext(f"{{{ARXIV_NS}}}name", "") for a in entry.findall(f"{{{ARXIV_NS}}}author")]
        author_str = f"{authors[0]} et al." if len(authors) > 1 else (authors[0] if authors else "Unknown")

        papers.append({
            "id":       arxiv_id,
            "title":    title,
            "authors":  author_str,
            "abstract": abstract,
            "published": published.strftime("%Y-%m-%d"),
            "url":      arxiv_id,
        })

    return papers


def assign_tags(title: str, abstract: str) -> list[str]:
    """제목 + 초록 텍스트에서 Notion 태그 자동 결정"""
    text = (title + " " + abstract).lower()
    tags = []
    for tag, keywords in TAG_RULES.items():
        if any(kw in text for kw in keywords):
            tags.append(tag)
    return tags[:5]  # 최대 5개


def get_existing_titles() -> set[str]:
    """Notion Reading List에서 기존 논문 제목 조회 (중복 방지)"""
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    headers = {
        "Authorization":  f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type":   "application/json",
    }
    payload = json.dumps({"page_size": 100}).encode()

    try:
        req  = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  Notion 조회 실패: {e}")
        return set()

    titles = set()
    for result in data.get("results", []):
        title_prop = result.get("properties", {}).get("Title", {})
        title_list = title_prop.get("title", [])
        if title_list:
            titles.add(title_list[0].get("plain_text", "").lower())
    return titles


def add_to_notion(paper: dict, tags: list[str]) -> bool:
    """Notion Reading List에 논문 1개 추가"""
    url     = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization":  f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type":   "application/json",
    }

    tag_objs = [{"name": t} for t in tags]
    payload  = {
        "parent": {"database_id": NOTION_DB_ID},
        "properties": {
            "Title":     {"title":       [{"text": {"content": paper["title"][:200]}}]},
            "Author":    {"rich_text":   [{"text": {"content": paper["authors"]}}]},
            "Status":    {"select":      {"name": "📖 To Read"}},
            "Venue":     {"select":      {"name": "ArXiv"}},
            "Year":      {"number":      datetime.now().year},
            "ArXiv URL": {"url":         paper["url"]},
            "Keywords":  {"multi_select": tag_objs},
            "date:Added:start": {"date": {"start": paper["published"]}},
        },
    }

    try:
        req  = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
        return True
    except Exception as e:
        print(f"  Notion 추가 실패 ({paper['title'][:50]}): {e}")
        return False


def main():
    print(f"🔬 arXiv Daily Digest 시작 — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"   최근 {LOOKBACK_HOURS}시간 내 논문 수집 중...\n")

    # 기존 제목 로드
    existing = get_existing_titles()
    print(f"  Notion 기존 논문 {len(existing)}개 확인 완료\n")

    seen_ids  = set()
    added     = 0

    for query in SEARCH_QUERIES:
        print(f"  🔎 검색: {query[:60]}...")
        papers = search_arxiv(query)

        for paper in papers:
            if paper["id"] in seen_ids:
                continue
            if paper["title"].lower() in existing:
                print(f"     ⏭  중복 스킵: {paper['title'][:60]}")
                continue

            seen_ids.add(paper["id"])
            tags = assign_tags(paper["title"], paper["abstract"])

            if add_to_notion(paper, tags):
                print(f"     ✅ 추가: {paper['title'][:70]}")
                print(f"        Tags: {tags}  |  {paper['published']}")
                added += 1
                existing.add(paper["title"].lower())

    print(f"\n📊 완료: {added}개 논문 Notion Reading List에 추가됨")


if __name__ == "__main__":
    main()
