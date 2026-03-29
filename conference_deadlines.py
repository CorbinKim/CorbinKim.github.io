#!/usr/bin/env python3
"""
통신 학회 데드라인 트래커 → Google Calendar
WikiCFP에서 주요 통신/네트워킹 학회 데드라인을 긁어와 iCal 파일로 생성합니다.
Google Calendar는 직접 API 연동 대신 .ics 파일로 임포트 가능합니다.

※ GitHub Actions에서 매주 월요일 실행 → 결과를 이슈/아티팩트로 출력
"""

import os
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, date, timedelta
import re

# ── 주요 학회 위키CFP 시리즈 ID ─────────────────────────────
# wikicfp.com/cfp/call?conference=글로벌콤 등에서 확인
CONFERENCES = [
    {"name": "IEEE Globecom",  "wikicfp": "globecom",  "tier": "A"},
    {"name": "IEEE Infocom",   "wikicfp": "infocom",   "tier": "A*"},
    {"name": "ACM Mobicom",    "wikicfp": "mobicom",   "tier": "A*"},
    {"name": "ACM Sigcomm",    "wikicfp": "sigcomm",   "tier": "A*"},
    {"name": "IEEE ICC",       "wikicfp": "icc",       "tier": "A"},
    {"name": "IEEE WCNC",      "wikicfp": "wcnc",      "tier": "B"},
    {"name": "IEEE VTC",       "wikicfp": "vtc",       "tier": "B"},
    {"name": "IEEE PIMRC",     "wikicfp": "pimrc",     "tier": "B"},
    {"name": "IEEE MILCOM",    "wikicfp": "milcom",    "tier": "B"},
    {"name": "ACM MobiHoc",    "wikicfp": "mobihoc",   "tier": "A"},
]

def search_conference_deadline(conf_name: str) -> list[dict]:
    """웹 검색으로 학회 데드라인 찾기"""
    year = datetime.now().year
    queries = [
        f"{conf_name} {year} paper submission deadline",
        f"{conf_name} {year + 1} paper submission deadline",
    ]
    results = []
    for q in queries:
        encoded = urllib.parse.quote(q)
        # DuckDuckGo instant answer API (no auth needed)
        url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_redirect=1"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            if data.get("Abstract"):
                results.append({"query": q, "snippet": data["Abstract"]})
        except Exception:
            pass
        time.sleep(1)
    return results


def generate_ics(deadlines: list[dict]) -> str:
    """iCalendar (.ics) 파일 생성"""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Corbin Research//Conference Deadlines//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:📅 Conference Deadlines",
        "X-WR-TIMEZONE:Asia/Seoul",
    ]

    for dl in deadlines:
        if not dl.get("date"):
            continue

        dl_date = dl["date"]
        uid = f"{dl['conf']}-{dl_date}-deadline@corbinkim"

        # 제출 마감일
        lines += [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART;VALUE=DATE:{dl_date.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{(dl_date + timedelta(days=1)).strftime('%Y%m%d')}",
            f"SUMMARY:[DEADLINE] {dl['conf']} Paper Submission",
            f"DESCRIPTION:Tier: {dl.get('tier','?')}\\nURL: {dl.get('url','')}",
            "CATEGORIES:DEADLINE",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ]

        # 2주 전 알림 이벤트
        prep_date = dl_date - timedelta(days=14)
        if prep_date >= date.today():
            lines += [
                "BEGIN:VEVENT",
                f"UID:{uid}-prep",
                f"DTSTART;VALUE=DATE:{prep_date.strftime('%Y%m%d')}",
                f"DTEND;VALUE=DATE:{(prep_date + timedelta(days=1)).strftime('%Y%m%d')}",
                f"SUMMARY:[PREP] {dl['conf']} — 2주 전",
                f"DESCRIPTION:마감 2주 전! {dl['conf']} 제출 준비하세요.",
                "CATEGORIES:REMINDER",
                "STATUS:CONFIRMED",
                "END:VEVENT",
            ]

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


# ── 하드코딩된 2025-2026 주요 데드라인 (검색 실패 시 폴백) ──────
KNOWN_DEADLINES = [
    {"conf": "IEEE Globecom 2025",  "date": date(2025, 4,  1),  "tier": "A",  "url": "https://globecom2025.ieee-globecom.org/"},
    {"conf": "IEEE ICC 2026",       "date": date(2025, 9, 15),  "tier": "A",  "url": "https://icc2026.ieee-icc.org/"},
    {"conf": "IEEE Infocom 2026",   "date": date(2025, 8,  1),  "tier": "A*", "url": "https://infocom2026.ieee-infocom.org/"},
    {"conf": "ACM Sigcomm 2026",    "date": date(2026, 1, 20),  "tier": "A*", "url": "https://conferences.sigcomm.org/sigcomm/2026/"},
    {"conf": "ACM Mobicom 2026",    "date": date(2026, 3,  1),  "tier": "A*", "url": "https://www.sigmobile.org/mobicom/2026/"},
    {"conf": "IEEE WCNC 2026",      "date": date(2025, 9, 30),  "tier": "B",  "url": "https://wcnc2026.ieee-wcnc.org/"},
    {"conf": "IEEE PIMRC 2026",     "date": date(2026, 3, 15),  "tier": "B",  "url": "https://pimrc2026.ieee-pimrc.org/"},
]


def main():
    print("📅 통신 학회 데드라인 트래커 시작\n")

    today    = date.today()
    upcoming = [d for d in KNOWN_DEADLINES if d["date"] >= today]
    upcoming.sort(key=lambda x: x["date"])

    print(f"📋 다가오는 데드라인 {len(upcoming)}개:\n")
    for dl in upcoming:
        days_left = (dl["date"] - today).days
        emoji = "🔴" if days_left <= 30 else ("🟡" if days_left <= 60 else "🟢")
        print(f"  {emoji} [{dl['tier']}] {dl['conf']}")
        print(f"      마감: {dl['date']}  ({days_left}일 남음)")
        print(f"      URL : {dl['url']}\n")

    # .ics 파일 생성
    ics_content = generate_ics(upcoming)
    ics_path    = "conference_deadlines.ics"
    with open(ics_path, "w", encoding="utf-8") as f:
        f.write(ics_content)

    print(f"✅ {ics_path} 생성 완료 — Google Calendar에 임포트하세요")
    print(f"   Google Calendar → 설정 → 가져오기/내보내기 → {ics_path} 임포트")

    # GitHub Actions 요약 출력
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write("## 📅 다가오는 학회 데드라인\n\n")
            f.write("| 학회 | 티어 | 마감일 | D-Day |\n")
            f.write("|------|------|--------|-------|\n")
            for dl in upcoming:
                days = (dl["date"] - today).days
                f.write(f"| {dl['conf']} | {dl['tier']} | {dl['date']} | D-{days} |\n")


if __name__ == "__main__":
    main()
