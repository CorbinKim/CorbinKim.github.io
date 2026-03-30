#!/usr/bin/env python3
"""
arXiv 논문 카테고리 기반 자동 분류
~/iCloud/01. 연구/01. Paper/00. 미분류/ 폴더 대상

arXiv API로 각 논문의 기본 카테고리를 조회하고
카테고리 서브폴더로 이동 + 파일명을 논문 제목으로 변경

결과 구조:
  01. Paper/
    ├── 00. 미분류/       ← arXiv에 없는 논문 (그대로)
    ├── cs.NI/            ← Networking and Internet Architecture
    ├── cs.IT/            ← Information Theory
    ├── cs.LG/            ← Machine Learning
    ├── cs.CL/            ← Computation and Language
    ├── eess.SP/          ← Signal Processing
    ├── 01. Globecom/     ← 기존 학회 폴더 유지
    ...

실행:
  python3 ~/Downloads/blog-automation/classify_by_arxiv_category.py
  python3 ~/Downloads/blog-automation/classify_by_arxiv_category.py --dry-run   # 미리보기
"""

import re, time, shutil, argparse, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

PAPER_DIR    = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs" \
               / "01. 연구" / "01. Paper"
UNCLASSIFIED = PAPER_DIR / "00. 미분류"

NS = "http://www.w3.org/2005/Atom"
ARXIV_PATTERN = re.compile(r'^(\d{4}\.\d{4,5})(v\d+)?$')

# 카테고리 한글 설명 (폴더명은 arXiv 코드 그대로 사용)
CATEGORY_DESC = {
    "cs.NI":   "Networking and Internet Architecture",
    "cs.IT":   "Information Theory",
    "cs.LG":   "Machine Learning",
    "cs.CL":   "Computation and Language",
    "cs.AI":   "Artificial Intelligence",
    "cs.CV":   "Computer Vision",
    "cs.DC":   "Distributed Computing",
    "cs.SY":   "Systems and Control",
    "eess.SP": "Signal Processing",
    "eess.SY": "Systems and Control",
    "stat.ML": "Machine Learning (Statistics)",
}


def clean_title(title: str) -> str:
    title = title.strip().replace("\n", " ")
    while "  " in title:
        title = title.replace("  ", " ")
    title = re.sub(r'[/:*?"<>|\\]', '', title)
    return title[:120].rsplit(' ', 1)[0].strip() if len(title) > 120 else title.strip()


def fetch_metadata(arxiv_id: str):
    """arXiv API로 제목 + 기본 카테고리 가져오기"""
    clean_id = re.sub(r'v\d+$', '', arxiv_id)
    url = f"https://export.arxiv.org/api/query?id_list={clean_id}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            root = ET.fromstring(r.read())
        entry = root.find(f"{{{NS}}}entry")
        if entry is None:
            return None

        title = clean_title(entry.findtext(f"{{{NS}}}title", "") or "")

        # 기본 카테고리: arxiv:primary_category
        primary = entry.find("{http://arxiv.org/schemas/atom}primary_category")
        if primary is None:
            primary = entry.find("primary_category")
        category = primary.get("term", "") if primary is not None else ""

        return {"title": title, "category": category} if title else None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="실행하지 않고 미리보기만")
    args = parser.parse_args()

    if not UNCLASSIFIED.exists():
        print(f"❌ 폴더 없음: {UNCLASSIFIED}")
        return

    files = sorted([f for f in UNCLASSIFIED.iterdir()
                    if f.is_file() and f.suffix.lower() == '.pdf'
                    and ARXIV_PATTERN.match(f.stem)])

    print(f"📂 대상 파일: {len(files)}개\n")
    if args.dry_run:
        print("[ DRY RUN — 실제 변경 없음 ]\n")

    results = {"moved": [], "failed": []}

    for f in files:
        print(f"  {f.stem}...", end=" ", flush=True)
        meta = fetch_metadata(f.stem)
        time.sleep(0.4)  # rate limit

        if not meta:
            results["failed"].append(f.stem)
            print("❌")
            continue

        title    = meta["title"]
        category = meta["category"]  # e.g. "cs.NI"

        # 목적지 폴더 결정
        if category:
            dest_dir = PAPER_DIR / category
        else:
            dest_dir = UNCLASSIFIED  # 카테고리 없으면 그대로

        new_name = f"{title}.pdf"
        new_path = dest_dir / new_name
        if new_path.exists():
            new_name = f"{title} [{f.stem}].pdf"
            new_path = dest_dir / new_name

        desc = CATEGORY_DESC.get(category, category)
        print(f"[{category}] {title[:55]}")

        if not args.dry_run:
            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(f), str(new_path))

        results["moved"].append({
            "id": f.stem, "title": title,
            "category": category, "desc": desc
        })

    # ── 요약 출력 ─────────────────────────────────────────────────────
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}✅ 완료: {len(results['moved'])}개 분류 / ❌ 실패: {len(results['failed'])}개")

    # 카테고리별 통계
    cats: dict[str, int] = {}
    for r in results["moved"]:
        cats[r["category"]] = cats.get(r["category"], 0) + 1
    if cats:
        print("\n[카테고리별 분류 결과]")
        for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
            desc = CATEGORY_DESC.get(cat, cat)
            print(f"  {cat:10s} ({desc}): {cnt}개")

    if results["failed"]:
        print("\n[조회 실패 — 수동 처리 필요]")
        for fid in results["failed"]:
            print(f"  https://arxiv.org/abs/{fid}")


if __name__ == "__main__":
    main()
