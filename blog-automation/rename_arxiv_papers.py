#!/usr/bin/env python3
"""
arXiv 논문 파일명 → 제목으로 일괄 변환
~/iCloud/01. 연구/01. Paper/00. 미분류/ 폴더 대상

실행 방법:
  python3 ~/Downloads/blog-automation/rename_arxiv_papers.py

arXiv ID 형태(2408.10390v2.pdf) 파일을 논문 제목으로 변경
예) 2408.10390v2.pdf → WirelessLLM Empowering Large Language Models Towards Wireless Intelligence.pdf
"""

import re, time, shutil, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from pathlib import Path

FOLDER = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs" \
         / "01. 연구" / "01. Paper" / "00. 미분류"

NS = "http://www.w3.org/2005/Atom"
ARXIV_PATTERN = re.compile(r'^(\d{4}\.\d{4,5})(v\d+)?$')

def clean_title(title: str) -> str:
    title = title.strip().replace("\n", " ")
    while "  " in title:
        title = title.replace("  ", " ")
    title = re.sub(r'[/:*?"<>|\\]', '', title)
    return title[:120].rsplit(' ', 1)[0].strip() if len(title) > 120 else title.strip()

def fetch_title(arxiv_id: str) -> str | None:
    clean_id = re.sub(r'v\d+$', '', arxiv_id)
    url = f"https://export.arxiv.org/api/query?id_list={clean_id}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            root = ET.fromstring(r.read())
        entry = root.find(f"{{{NS}}}entry")
        if entry is not None:
            title = entry.findtext(f"{{{NS}}}title", "")
            return clean_title(title) if title else None
    except Exception:
        return None
    return None

def main():
    if not FOLDER.exists():
        print(f"❌ 폴더 없음: {FOLDER}")
        return

    files = [f for f in FOLDER.iterdir()
             if f.is_file() and f.suffix.lower() == '.pdf'
             and ARXIV_PATTERN.match(f.stem)]

    print(f"📂 대상 파일: {len(files)}개\n")
    renamed, failed = [], []

    for f in sorted(files):
        print(f"  {f.stem}...", end=" ", flush=True)
        title = fetch_title(f.stem)
        time.sleep(0.4)  # arXiv rate limit

        if title:
            new_path = f.parent / f"{title}.pdf"
            if new_path.exists():
                new_path = f.parent / f"{title} [{f.stem}].pdf"
            f.rename(new_path)
            renamed.append(f.stem)
            print(f"✅ {title[:65]}")
        else:
            failed.append(f.stem)
            print("❌ 실패")

    print(f"\n✅ 완료: {len(renamed)}개 변환 / ❌ 실패: {len(failed)}개")
    if failed:
        print("\n[수동 처리 필요]")
        for fid in failed:
            print(f"  https://arxiv.org/abs/{fid}")

if __name__ == "__main__":
    main()
