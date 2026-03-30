#!/usr/bin/env python3
"""
Google OAuth2 Refresh Token 발급 헬퍼 (최초 1회만 실행)
결과로 얻은 refresh_token을 GitHub Secrets에 GOOGLE_REFRESH_TOKEN으로 저장

사전 준비:
  1. https://console.cloud.google.com/ → 프로젝트 생성
  2. API 라이브러리 → Gmail API 활성화
  3. OAuth 동의 화면 → 외부 / 테스트 사용자에 내 Gmail 추가
  4. 사용자 인증 정보 → OAuth 2.0 클라이언트 ID
     - 유형: 데스크톱 앱
     - 다운로드한 JSON에서 client_id, client_secret 복사

실행 방법:
  python get_google_token.py --client-id YOUR_ID --client-secret YOUR_SECRET
"""

import argparse, json, urllib.request, urllib.parse, webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler

AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL  = "https://oauth2.googleapis.com/token"
SCOPE      = "https://www.googleapis.com/auth/gmail.readonly"
REDIRECT   = "http://localhost:9000/callback"

auth_code = None


class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        auth_code = params.get("code", [None])[0]
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"<h2>Authorization complete! Close this window.</h2>")
        print(f"\n  인증 코드 수신 완료")

    def log_message(self, *args):
        pass  # 로그 억제


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-id",     required=True)
    parser.add_argument("--client-secret", required=True)
    args = parser.parse_args()

    # 1. 브라우저에서 인증 URL 열기
    params = urllib.parse.urlencode({
        "client_id":     args.client_id,
        "redirect_uri":  REDIRECT,
        "response_type": "code",
        "scope":         SCOPE,
        "access_type":   "offline",
        "prompt":        "consent",
    })
    url = f"{AUTH_URL}?{params}"
    print(f"\n🔗 브라우저에서 다음 URL로 Google 계정 인증이 진행됩니다:\n   {url}\n")
    webbrowser.open(url)

    # 2. localhost:9000/callback 에서 code 수신
    print("⏳ 인증 대기 중 (http://localhost:9000/callback)...")
    server = HTTPServer(("localhost", 9000), CallbackHandler)
    server.handle_request()

    if not auth_code:
        print("❌ 인증 코드를 받지 못했습니다.")
        return

    # 3. code → refresh_token 교환
    payload = urllib.parse.urlencode({
        "code":          auth_code,
        "client_id":     args.client_id,
        "client_secret": args.client_secret,
        "redirect_uri":  REDIRECT,
        "grant_type":    "authorization_code",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        tokens = json.loads(r.read())

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        print("❌ refresh_token이 없습니다. Google 동의 화면에서 '오프라인 액세스'가 허용됐는지 확인하세요.")
        return

    print("\n" + "="*60)
    print("✅ GitHub Secrets에 아래 값들을 추가하세요:")
    print(f"   GOOGLE_CLIENT_ID     = {args.client_id}")
    print(f"   GOOGLE_CLIENT_SECRET = {args.client_secret}")
    print(f"   GOOGLE_REFRESH_TOKEN = {refresh_token}")
    print("="*60)
    print("\n→ https://github.com/corbinkim/corbinkim.github.io/settings/secrets/actions")


if __name__ == "__main__":
    main()
