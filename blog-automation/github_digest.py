#!/usr/bin/env python3
"""
GitHub 주간 커밋 요약 → Notion 페이지 생성

동작:
  1. GitHub API로 지정 레포의 최근 7일 커밋 조회
  2. 통계 집계 (커밋 수, 파일 변경, 주요 메시지)
  3. Notion Academic Planner에 Weekly GitHub Summary 페이지 생성

환경 변수:
  GH_TOKEN     : GitHub Personal Access Token (repo scope)
  NOTION_TOKEN : Notion Integration Token

실행:
  python3 github_digest.py
"""

import os, json, urllib.request, urllib.error, urllib.parse
from datetime import date, datetime, timedelta, timezone

# ── 설정 ──────────────────────────────────────────────────────────────────────
GH_TOKEN         = os.environ.get("GH_TOKEN", "")
NOTION_TOKEN     = os.environ.get("NOTION_TOKEN", "")
NOTION_PLANNER_ID = "2f37d5cddea18106af19d9d701498d65"
NOTION_VERSION   = "2022-06-28"
GH_USERNAME      = "CorbinKim"

# 추적할 레포 목록 (owner/repo 형식)
REPOS = [
    "CorbinKim/CorbinKim.github.io",
    # 아래는 iCloud git repo — GitHub remote가 있는 경우에만 추가
    # "CorbinKim/TelcoAgent",
]


# ── GitHub API 헬퍼 ───────────────────────────────────────────────────────────
def gh_request(path: str):
    url = f"https://api.github.com{path}"
    req = urllib.request.Request(url)
    if GH_TOKEN:
        req.add_header("Authorization", f"Bearer {GH_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  GitHub API error {e.code}: {path}")
        return None


def get_commits(repo: str, since_iso: str) -> list:
    """since_iso 이후 커밋 전체 수집 (페이지네이션)"""
    commits = []
    page    = 1
    while True:
        params = urllib.parse.urlencode({
            "author": GH_USERNAME,
            "since":  since_iso,
            "per_page": 100,
            "page":   page,
        })
        result = gh_request(f"/repos/{repo}/commits?{params}")
        if not result or not isinstance(result, list):
            break
        commits.extend(result)
        if len(result) < 100:
            break
        page += 1
    return commits


def get_commit_detail(repo: str, sha: str) -> dict:
    """커밋 상세 (파일 변경 수) 조회"""
    result = gh_request(f"/repos/{repo}/commits/{sha}")
    return result or {}


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
    return [{"type": "text", "text": {"content": str(text)}}]


def rt_link(text: str, url: str) -> list:
    return [{"type": "text", "text": {"content": text, "link": {"url": url}}}]


def bullet(text: str, link_url: str = "") -> dict:
    rich = rt_link(text, link_url) if link_url else rt(text)
    return {"bulleted_list_item": {"rich_text": rich}}


def divider() -> dict:
    return {"divider": {}}


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    if not NOTION_TOKEN:
        print("❌ NOTION_TOKEN 환경 변수가 없습니다.")
        return
    if not GH_TOKEN:
        print("⚠️  GH_TOKEN 없음 — public repo만 조회 가능 (rate limit 낮음)")

    today    = date.today()
    week_ago = today - timedelta(days=7)
    since_iso = datetime(week_ago.year, week_ago.month, week_ago.day,
                         tzinfo=timezone.utc).isoformat()

    print(f"📊 GitHub Weekly Digest — {week_ago} ~ {today}\n")

    all_repo_stats = []

    for repo in REPOS:
        print(f"  📦 {repo}")
        commits = get_commits(repo, since_iso)
        print(f"     커밋 수: {len(commits)}개")

        if not commits:
            all_repo_stats.append({"repo": repo, "commits": [], "total": 0,
                                   "additions": 0, "deletions": 0, "files": 0})
            continue

        # 상세 통계 (최대 20개 커밋만 상세 조회 — API 절약)
        additions = 0
        deletions = 0
        files_changed = 0
        for c in commits[:20]:
            sha    = c["sha"]
            detail = get_commit_detail(repo, sha)
            stats  = detail.get("stats", {})
            additions    += stats.get("additions", 0)
            deletions    += stats.get("deletions", 0)
            files_changed += len(detail.get("files", []))

        all_repo_stats.append({
            "repo":      repo,
            "commits":   commits,
            "total":     len(commits),
            "additions": additions,
            "deletions": deletions,
            "files":     files_changed,
        })
        print(f"     +{additions} / -{deletions} lines, {files_changed} files")

    # ── Notion 페이지 빌드 ─────────────────────────────────────────────────────
    total_commits = sum(r["total"] for r in all_repo_stats)
    title_str = f"🛠 GitHub Weekly — {week_ago} ~ {today} ({total_commits} commits)"

    blocks = [
        {"paragraph": {"rich_text": rt(
            f"기간: {week_ago} ~ {today}  |  총 커밋: {total_commits}개  |  레포: {len(REPOS)}개"
        )}},
        divider(),
    ]

    for stat in all_repo_stats:
        repo    = stat["repo"]
        commits = stat["commits"]
        repo_url = f"https://github.com/{repo}"

        blocks.append({"heading_2": {"rich_text": rt_link(repo, repo_url)}})
        blocks.append({"paragraph": {"rich_text": rt(
            f"커밋 {stat['total']}개  |  +{stat['additions']} / -{stat['deletions']} lines  |  {stat['files']} files"
        )}})

        if commits:
            for c in commits[:15]:  # 최대 15개 표시
                msg    = c["commit"]["message"].split("\n")[0][:80]
                sha    = c["sha"][:7]
                c_url  = f"https://github.com/{repo}/commit/{c['sha']}"
                date_s = c["commit"]["committer"]["date"][:10]
                blocks.append(bullet(f"[{date_s}] {sha}  {msg}", c_url))

            if len(commits) > 15:
                blocks.append({"paragraph": {"rich_text": rt(
                    f"... 외 {len(commits) - 15}개 커밋"
                )}})
        else:
            blocks.append({"paragraph": {"rich_text": rt("이번 주 커밋 없음.")}})

        blocks.append(divider())

    page_body = {
        "parent": {"page_id": NOTION_PLANNER_ID},
        "icon":   {"type": "emoji", "emoji": "🛠"},
        "properties": {
            "title": {"title": rt(title_str)}
        },
        "children": [{"object": "block", "type": list(b.keys())[0], **b} for b in blocks]
    }

    print(f"\n  📝 Notion 페이지 생성 중...")
    result = notion_request("POST", "/pages", page_body)
    if result:
        print(f"  ✅ 완료: {result.get('url', '')}")
    else:
        print(f"  ❌ Notion 페이지 생성 실패")


if __name__ == "__main__":
    main()
