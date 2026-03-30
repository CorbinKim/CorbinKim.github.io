/**
 * gmail_triage.gs — Gmail → Notion Inbox DB
 *
 * 기존: Academic Planner에 standalone 페이지 생성 (문제: 계속 쌓임)
 * 신규: Inbox DB에 이메일 1개당 1개 항목 생성
 *
 * 설정:
 *   Google Apps Script 프로젝트 속성 → 스크립트 속성에 추가:
 *     NOTION_TOKEN  : secret_xxxxx
 *
 * 실행 주기: 매일 08:30 (시간 기반 트리거)
 */

// ── 상수 ────────────────────────────────────────────────────────────────────
const INBOX_DB_ID   = "9d1d2395afe64a86bb5abc4a5920c213"; // 📬 Inbox DB
const NOTION_VERSION = "2022-06-28";
const HOURS_BACK    = 24;   // 최근 N시간 이내 이메일만 처리
const MAX_EMAILS    = 30;   // 최대 처리 이메일 수
const SUMMARY_CHARS = 200;  // Summary 필드 최대 글자 수

// ── 메인 함수 ────────────────────────────────────────────────────────────────
function runGmailTriage() {
  const token = PropertiesService.getScriptProperties().getProperty("NOTION_TOKEN");
  if (!token) {
    Logger.log("❌ NOTION_TOKEN이 설정되지 않았습니다.");
    return;
  }

  const emails = fetchRecentEmails();
  if (emails.length === 0) {
    Logger.log("✅ 새 이메일 없음.");
    return;
  }

  Logger.log(`📬 ${emails.length}개 이메일 처리 시작...`);

  let created = 0;
  for (const email of emails) {
    const success = createInboxEntry(token, email);
    if (success) created++;
    Utilities.sleep(300); // Notion API rate limit 방지
  }

  Logger.log(`✅ Inbox DB에 ${created}개 항목 생성 완료.`);
}

// ── Gmail 읽기 ───────────────────────────────────────────────────────────────
function fetchRecentEmails() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - HOURS_BACK);

  // 중요/읽지 않은 이메일 우선, 스팸·휴지통 제외
  const query = `is:unread -in:spam -in:trash after:${formatDateForQuery(cutoff)}`;
  const threads = GmailApp.search(query, 0, MAX_EMAILS);

  const emails = [];
  for (const thread of threads) {
    const msg = thread.getMessages()[0]; // 각 스레드의 첫 번째 메시지
    const body = msg.getPlainBody().replace(/\s+/g, " ").trim();

    emails.push({
      subject : msg.getSubject() || "(제목 없음)",
      from    : msg.getFrom(),
      date    : msg.getDate(),
      summary : body.substring(0, SUMMARY_CHARS),
      threadId: thread.getId(),
      gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${thread.getId()}`,
    });
  }

  return emails;
}

function formatDateForQuery(date) {
  // Gmail search query 형식: YYYY/MM/DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

// ── Notion Inbox DB에 항목 생성 ──────────────────────────────────────────────
function createInboxEntry(token, email) {
  const isoDate = email.date.toISOString().split("T")[0]; // YYYY-MM-DD

  // 발신자 이름만 추출 (e.g. "John Doe <john@example.com>" → "John Doe")
  const fromName = email.from.replace(/<[^>]+>/, "").trim() || email.from;
  const title    = `[Gmail] ${email.subject}`;
  const summary  = `From: ${fromName}\n\n${email.summary}`;

  const payload = {
    parent: { database_id: INBOX_DB_ID },
    properties: {
      "Title": {
        title: [{ text: { content: title } }]
      },
      "Date": {
        date: { start: isoDate }
      },
      "Source": {
        select: { name: "Gmail" }
      },
      "Status": {
        select: { name: "New" }
      },
      "Summary": {
        rich_text: [{ text: { content: summary.substring(0, 2000) } }]
      },
      "Link": {
        url: email.gmailUrl
      }
    }
  };

  const options = {
    method      : "post",
    contentType : "application/json",
    headers     : {
      "Authorization"  : `Bearer ${token}`,
      "Notion-Version" : NOTION_VERSION,
    },
    payload     : JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch("https://api.notion.com/v1/pages", options);
  const code     = response.getResponseCode();

  if (code === 200) {
    Logger.log(`  ✅ 생성: ${title}`);
    return true;
  } else {
    Logger.log(`  ❌ 실패 (${code}): ${title}\n${response.getContentText()}`);
    return false;
  }
}

// ── 중복 방지: 오늘 이미 처리한 스레드 건너뛰기 ─────────────────────────────
// (선택 사항: 하루 2번 이상 실행 시 유용)
function isDuplicate(token, threadId) {
  const today = new Date().toISOString().split("T")[0];
  const url   = `https://api.notion.com/v1/databases/${INBOX_DB_ID}/query`;

  const payload = {
    filter: {
      and: [
        { property: "Source",  select: { equals: "Gmail" } },
        { property: "Date",    date:   { equals: today }   },
        { property: "Link",    url:    { contains: threadId } },
      ]
    },
    page_size: 1,
  };

  const options = {
    method      : "post",
    contentType : "application/json",
    headers     : {
      "Authorization"  : `Bearer ${token}`,
      "Notion-Version" : NOTION_VERSION,
    },
    payload     : JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const res  = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(res.getContentText());
  return data.results && data.results.length > 0;
}
