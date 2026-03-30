#!/usr/bin/env python3
"""
Downloads 폴더 자동 정리기
~/Downloads 루트의 파일들을 iCloud Drive 카테고리 폴더로 이동 후 Downloads에서 삭제

iCloud 구조 (2026.03 기준):
  01. 연구/
    ├── 01. Paper/00. 미분류/  ← 논문 PDF
    ├── 02. TelcoAgent/        ← git repo (건드리지 않음)
    ├── 03. Data/              ← 연구 데이터
    └── 04. Code/              ← 코드 프로젝트
  02. 업무/
    ├── 01. Culcom/            ← 학원 교육 영상
    ├── 02. 행정/              ← 연구실 행정
    ├── 03. 발표/01. 발표자료/ ← 발표 자료
    └── 04. 오픈랜/            ← 오픈랜 과제
  04. 개인/
    ├── 01. 서류/              ← 개인 서류
    ├── 02. 학원/              ← 영어 강의 자료
    ├── 03. 책/                ← 기술서적
    └── 04. 공부/              ← 수업/인강 자료
"""

import os, shutil
from pathlib import Path
from datetime import datetime

DOWNLOADS = Path.home() / "Downloads"
ICLOUD    = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs"

# ── 목적지 경로 (iCloud Drive 절대경로) ────────────────────────────────
DEST = {
    "논문":       ICLOUD / "01. 연구" / "01. Paper" / "00. 미분류",
    "발표":       ICLOUD / "02. 업무" / "03. 발표" / "01. 발표자료",
    "영어시험":   ICLOUD / "04. 개인" / "02. 학원",
    "이미지":     DOWNLOADS / "04. Images",          # 이미지는 Downloads 유지
    "개인서류":   ICLOUD / "04. 개인" / "01. 서류",
    "연구데이터": ICLOUD / "01. 연구" / "03. Data",
    "책":         ICLOUD / "04. 개인" / "03. 책",
}

# ── 분류 규칙 (순서대로 매칭, 첫 번째 매칭에서 중단) ──────────────────
RULES = [
    {
        "dest":       "개인서류",
        "extensions": {".pdf", ".docx", ".hwp", ".doc", ".jpg", ".jpeg", ".png"},
        "keywords":   ["cv", "resume", "passport", "visa", "offer", "contract",
                       "certificate", "transcript", "이력서", "여권", "증명서",
                       "재직", "재학", "졸업", "성적", "admission"],
    },
    {
        "dest":       "영어시험",
        "extensions": {".pdf", ".docx", ".hwp", ".doc"},
        "keywords":   ["영어", "toefl", "toeic", "ielts", "수능", "모의고사",
                       "어법", "독해", "문법", "listening", "grammar",
                       "중2", "중3", "고1", "고2", "고3"],
    },
    {
        "dest":       "책",
        "extensions": {".pdf", ".epub"},
        "keywords":   ["textbook", "교재", "교과서", "introduction to", "fundamentals of",
                       "handbook", "guide", "wiley", "springer book", "oreilly",
                       "길벗", "한빛", "인사이트"],
    },
    {
        "dest":       "논문",
        "extensions": {".pdf"},
        "keywords":   ["paper", "arxiv", "ieee", "acm", "springer", "survey",
                       "conference", "journal", "preprint", "llm", "network",
                       "telecom", "wireless", "ran", "ntn", "5g", "6g",
                       "transformer", "neural", "learning", "globecom",
                       "infocom", "mobicom", "sigcomm", "icc", "wcnc"],
    },
    {
        "dest":       "연구데이터",
        "extensions": {".csv", ".json", ".zip", ".tar", ".gz", ".ipynb", ".py", ".mat", ".h5"},
        "keywords":   ["dataset", "data", "model", "experiment", "result", "기지국"],
    },
    {
        "dest":       "발표",
        "extensions": {".pptx", ".ppt", ".key"},
        "keywords":   [],  # 확장자만으로 분류
    },
    {
        "dest":       "이미지",
        "extensions": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
                       ".heic", ".heif", ".bmp", ".tiff", ".tif"},
        "keywords":   [],
    },
]

# 이동하지 않을 파일/폴더
SKIP_NAMES = {
    "blog-automation",
    ".DS_Store",
    ".localized",
    "01. 연구",
    "02. Presentations",
    "03. 영어시험",
    "04. Images",
    "05. Personal",
}

# 너무 최근 파일은 건드리지 않음 (다운로드 중일 수 있음, 30초 이내)
MIN_AGE_SECONDS = 30


def classify_file(path: Path) -> str | None:
    """파일을 분류하여 DEST 키 반환. 분류 안 되면 None."""
    ext  = path.suffix.lower()
    name = path.stem.lower()

    for rule in RULES:
        if ext not in rule["extensions"]:
            continue
        keywords = rule["keywords"]
        if not keywords:
            return rule["dest"]
        if any(kw in name for kw in keywords):
            return rule["dest"]

    # PDF는 기본적으로 논문 폴더로
    if ext == ".pdf":
        return "논문"

    return None


def safe_move(src: Path, dest_dir: Path) -> bool:
    """파일을 안전하게 이동. 동일 이름 존재 시 번호 붙임."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name

    if dest.exists():
        stem, suffix = src.stem, src.suffix
        counter = 2
        while dest.exists():
            dest = dest_dir / f"{stem}_{counter}{suffix}"
            counter += 1

    shutil.move(str(src), str(dest))
    return True


def main():
    now = datetime.now()
    moved = []
    skipped = []

    for item in DOWNLOADS.iterdir():
        # 폴더/시스템 파일 스킵
        if item.name in SKIP_NAMES or item.name.startswith("."):
            continue
        if item.is_dir():
            continue

        # 너무 최근 파일 스킵 (다운로드 중, 30초 이내)
        try:
            age = now.timestamp() - item.stat().st_mtime
            if age < MIN_AGE_SECONDS:
                skipped.append(f"  ⏳ {item.name} (다운로드 중)")
                continue
        except OSError:
            continue

        # 분류
        dest_key = classify_file(item)
        if dest_key is None:
            skipped.append(f"  ❓ {item.name} (분류 불가, 수동 정리 필요)")
            continue

        dest_dir = DEST[dest_key]
        label    = str(dest_dir).replace(str(Path.home()), "~")

        try:
            safe_move(item, dest_dir)
            moved.append(f"  ✅ {item.name}\n     → {label}/")
        except Exception as e:
            skipped.append(f"  ❌ {item.name} (오류: {e})")

    # 결과 출력
    print(f"📁 Downloads 정리 완료 — {now.strftime('%Y-%m-%d %H:%M')}")
    print(f"   이동: {len(moved)}개 / 스킵: {len(skipped)}개\n")

    if moved:
        print("이동된 파일:")
        for m in moved:
            print(m)

    if skipped:
        print("\n스킵된 파일:")
        for s in skipped:
            print(s)


if __name__ == "__main__":
    main()
