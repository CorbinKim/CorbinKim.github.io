#!/usr/bin/env python3
"""
Semantic Scholar 인용 추적기

Corbin(Geon) Kim의 논문들의 인용 수 변화를 추적하고 Notion에 기록합니다.

동작:
  1. Semantic Scholar API로 저자 "Geon Kim" (NCSU) 논문 목록 조회
  2. 각 논문의 현재 인용 수 확인
  3. 이전 기록과 비교 → 신규 인용 감지
  4. Notion Academic Planner에 Citation Report 페이지 생성

환경 변수:
  NOTION_TOKEN : Notion Integration Token
  S2_API_KEY   : Semantic Scholar API Key (선택, 없으면 무인증 사용 — rate limit 낮음)

실행:
  python3 citation_tracker.py
"""

import os, json, time, urllib.request, urllib.error, urllib.parse
from datetime import date, datetime
from pathlib import Path

# ── 설정 ──────────────────────────────────────────────────────────────────────
NOTION_TOKEN     = os.environ.get("NOTION_TOKEN", "")
S2_API_KEY       = os.environ.get("S2_API_KEY", "")
NOTION_PLANNER_ID = "2f37d5cddea18106af19d9d701498d65"
NOTION_VERSION   = "2022-06-28"

# Semantic Scholar 저자 ID (Corbin = Geon Kim at NCSU)
# 자동 검색하므로 비워두면 이름으로 검색
S2_AUTHOR_NAME   = "Geon Kim"
S2_AFFILIATION   = "North Carolina State University"

# 이전 인용 기록 캐시 (GitHub Actions: workspace에 저장됨)
CACHE_FILE = Path(os.environ.get("CITATION_CACHE_PATH",
                  str(Path(__file__).parent / ".citation_cache.json")))

S2_BASE = "https://api.semanticscholar.org/graph/v1"


# ── Semantic Scholar API 헬퍼 ─────────────────────────────────────────────────
def s2_request(path: str, params: dict = None):
    url = f"{S2_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)
    if S2_API_KEY:
        req.add_header("x-api-key", S2_API_KEY)
    req.add_header("User-Agent", "citation-tracker/1.0 (research@ncsu.edu)")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  ⏳ Rate limit — 60초 대기 후 재시도...")
            time.sleep(60)
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        print(f"  S2 API error {e.code}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"  S2 request failed: {e}")
        return None


def find_author_id(name: str, affiliation: str) -> str:
    """저자 이름으로 Semantic Scholar author ID 검색"""
    result = s2_request("/author/search", {
        "query": name,
        "fields": "authorId,name,affiliations,paperCount,citationCount",
        "limit": 10,
    })
    if not result or "data" not in result:
        return ""

    for author in result["data"]:
        affs = " ".join(author.get("affiliations") or []).lower()
        if affiliation.lower()[:10] in affs or "ncsu" in affs or "north carolina" in affs:
            return author["authorId"]

    # fallback: 첫 번째 결과
    return result["data"][0]["authorId"] if result["data"] else ""


def get_papers(author_id: str) -> list:
    """저자의 논문 목록 + 인용 수 조회"""
    result = s2_request(f"/author/{author_id}/papers", {
        "fields": "paperId,title,year,citationCount,externalIds,venue,authors",
        "limit": 100,
    })
    return result.get("data", []) if result else []


# ── 캐시 ──────────────────────────────────────────────────────────────────────
def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text())
        except Exception:
            pass
    return {}


def save_cache(data: dict):
    CACHE_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


# ── Notion 헬퍼 ───────────────────────────────────────────────────────────────
def notion_request(method: str, path: str, body=None):
    url  = f"https://api.notion.com/v1{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {NOTION_TOKEN}")
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  Notion API error {e.code}: {e.read().decode()[:200]}")
        return None


def rt(text: str) -> list:
    """Rich text 블록 생성"""
    return [{"type": "text", "text": {"content": str(text)}}]


def heading(level: int, text: str) -> dict:
    return {f"heading_{level}": {"rich_text": rt(text)}}


def bullet(text: str) -> dict:
    return {"bulleted_list_item": {"rich_text": rt(text)}}


def divider() -> dict:
    return {"divider": {}}


def build_report_page(papers: list, cache: dict, today: str) -> dict:
    """Notion 페이지 body 빌드"""
    total_citations = sum(p.get("citationCount", 0) for p in papers)
    new_citations   = []

    for p in papers:
        pid   = p.get("paperId", "")
        curr  = p.get("citationCount", 0)
        prev  = cache.get(pid, {}).get("citationCount", 0)
        delta = curr - prev
        if delta > 0:
            new_citations.append((p.get("title", "Unknown"), delta, curr, prev))

    blocks = [
        {"paragraph": {"rich_text": rt(
            f"📊 Citation Report — {today}  |  총 논문: {len(papers)}편  |  총 인용: {total_citations}회"
        )}},
        divider(),
    ]

    if new_citations:
        blocks.append({"heading_2": {"rich_text": rt(f"🆕 신규 인용 ({len(new_citations)}편)")}})
        for title, delta, curr, prev in sorted(new_citations, key=lambda x: -x[1]):
            blocks.append(bullet(f"+{delta} 인용 → 누적 {curr}회 (이전 {prev})  |  {title[:80]}"))
        blocks.append(divider())
    else:
        blocks.append({"paragraph": {"rich_text": rt("이전 추적 이후 신규 인용 없음.")}})
        blocks.append(divider())

    blocks.append({"heading_2": {"rich_text": rt("📄 전체 논문 현황")}})
    sorted_papers = sorted(papers, key=lambda x: -(x.get("citationCount") or 0))
    for p in sorted_papers:
        pid   = p.get("paperId", "")
        title = p.get("title", "Unknown")[:80]
        cites = p.get("citationCount", 0)
        year  = p.get("year") or "?"
        venue = p.get("venue") or "?"
        arxiv = (p.get("externalIds") or {}).get("ArXiv", "")
        link  = f"https://arxiv.org/abs/{arxiv}" if arxiv else \
                f"https://www.semanticscholar.org/paper/{pid}"
        blocks.append(bullet(f"[{year}] {cites}회 인용  |  {venue}  |  {title}"))

    return {
        "parent": {"page_id": NOTION_PLANNER_ID},
        "icon":   {"type": "emoji", "emoji": "📊"},
        "properties": {
            "title": {"title": rt(f"📊 Citation Report — {today}")}
        },
        "children": [{"object": "block", "type": list(b.keys())[0], **b} for b in blocks]
    }


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    if not NOTION_TOKEN:
        print("❌ NOTION_TOKEN 환경 변수가 없습니다.")
        return

    today = date.today().isoformat()
    print(f"📊 Citation Tracker — {today}\n")

    # 1. 저자 ID 탐색
    print(f"  🔍 Semantic Scholar에서 '{S2_AUTHOR_NAME}' 검색 중...")
    author_id = find_author_id(S2_AUTHOR_NAME, S2_AFFILIATION)
    if not author_id:
        print("  ❌ 저자를 찾을 수 없습니다.")
        return
    print(f"  ✅ Author ID: {author_id}")

    # 2. 논문 목록 조회
    time.sleep(1)
    print(f"  📄 논문 목록 조회 중...")
    papers = get_papers(author_id)
    print(f"  ✅ {len(papers)}편 확인\n")

    if not papers:
        print("  논문이 없습니다.")
        return

    # 3. 캐시 로드 및 비교
    cache = load_cache()
    total = sum(p.get("citationCount", 0) for p in papers)
    print(f"  📊 총 인용 수: {total}회")

    new_count = 0
    for p in papers:
        pid   = p.get("paperId", "")
        curr  = p.get("citationCount", 0)
        prev  = cache.get(pid, {}).get("citationCount", -1)
        if prev < 0:
            print(f"     신규 추적: {p.get('title', '')[:60]} ({curr}회)")
        elif curr > prev:
            delta = curr - prev
            new_count += delta
            print(f"     +{delta} 인용: {p.get('title', '')[:60]}")

    print(f"\n  🆕 신규 인용 합계: {new_count}회\n")

    # 4. Notion 리포트 페이지 생성
    print(f"  📝 Notion 리포트 생성 중...")
    page_body = build_report_page(papers, cache, today)
    result = notion_request("POST", "/pages", page_body)
    if result:
        print(f"  ✅ Notion 페이지 생성 완료: {result.get('url', '')}")
    else:
        print(f"  ❌ Notion 페이지 생성 실패")

    # 5. 캐시 업데이트
    new_cache = {}
    for p in papers:
        pid = p.get("paperId", "")
        new_cache[pid] = {
            "title":         p.get("title", ""),
            "citationCount": p.get("citationCount", 0),
            "updated":       today,
        }
    save_cache(new_cache)
    print(f"  💾 캐시 저장 완료: {CACHE_FILE}")


if __name__ == "__main__":
    main()
