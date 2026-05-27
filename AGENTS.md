# CorbinKim.github.io — Jekyll Blog

## Stack
- Jekyll + Hydejack 테마
- Posts: paper/_posts/YYYY-MM-DD-title.md
- Categories: paper, aimlfw, netllm, sim

## 브라우저 작성 파이프라인
- 공식 작성 경로: `https://corbinkim.github.io/admin/` Sveltia CMS → GitHub Markdown commit → GitHub Pages/Jekyll 발행
- 설정 파일: `admin/config.yml`
- Paper Reviews: `paper/_posts/YYYY-MM-DD-title.md`
- Obsidian은 개인 연구 노트 용도이며 발행 자동화와 연결하지 않음
- Notion은 현재 발행 파이프라인에서 사용하지 않음

## GitHub Actions
- arxiv-daily-digest.yml: Notion 기반 arXiv digest 비활성화됨
- blog-publisher.yml: Notion publisher 비활성화됨. Sveltia CMS 사용
- citation-tracker.yml: Notion 기반 citation tracker 비활성화됨
- conference-deadlines.yml: 학회 데드라인 체크
- weekly-review.yml: Notion 기반 주간 리뷰 비활성화됨

## 자동화 스크립트
- blog-automation/: legacy/utility 스크립트. 블로그 발행의 공식 경로는 Sveltia CMS

## 규칙
- main에 force-push 금지
- `bundle exec jekyll serve`로 로컬 테스트 후 push
- 한국어 본문, 영어 코드 블록
