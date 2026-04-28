import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'ang.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    requester TEXT NOT NULL,
    approver TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created TEXT,
    decided TEXT,
    amount TEXT,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    time TEXT,
    shared INTEGER DEFAULT 0,
    color TEXT,
    owner TEXT,
    desc TEXT,
    ai INTEGER DEFAULT 0,
    ai_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS board_posts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    author TEXT NOT NULL,
    date TEXT,
    views INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS board_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_chat INTEGER DEFAULT 0,
    members TEXT,
    last TEXT,
    time TEXT,
    unread INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    from_user TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mails (
    id TEXT PRIMARY KEY,
    from_user TEXT NOT NULL,
    subject TEXT,
    preview TEXT,
    time TEXT,
    unread INTEGER DEFAULT 0,
    starred INTEGER DEFAULT 0,
    has_attach INTEGER DEFAULT 0,
    trashed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sent_mails (
    id TEXT PRIMARY KEY,
    to_user TEXT,
    subject TEXT,
    preview TEXT,
    time TEXT,
    has_attach INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    col TEXT DEFAULT 'todo',
    assignee TEXT,
    due TEXT,
    tag TEXT,
    priority TEXT DEFAULT 'mid'
  );

  CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    birth TEXT,
    dept_code TEXT,
    dept TEXT DEFAULT '미배정',
    rank TEXT DEFAULT '사원',
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
`);

// ── 시드 데이터 (테이블 비어있을 때만 삽입) ──

const count = (table) => db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;

if (count('approvals') === 0) {
  const ins = db.prepare(`INSERT INTO approvals VALUES (@id,@title,@requester,@approver,@status,@created,@decided,@amount,@reason)`);
  [
    { id:'a1', title:'행사지원 신청서 (5월 평생교육 페스티벌)', requester:'u_me',   approver:'u_lead', status:'pending',  created:'2026-04-19', decided:null, amount:'₩4,200,000', reason:null },
    { id:'a2', title:'외부강사 초빙 요청 (김민수)',            requester:'u_park', approver:'u_lead', status:'approved', created:'2026-04-16', decided:'2026-04-17', amount:'₩800,000', reason:null },
    { id:'a3', title:'3월 비품 구매 품의',                     requester:'u_kim',  approver:'u_lead', status:'rejected', created:'2026-04-12', decided:'2026-04-13', amount:'₩1,150,000', reason:'견적서 재첨부 필요' },
    { id:'a4', title:'하반기 워크숍 예산안',                   requester:'u_gal',  approver:'u_lead', status:'pending',  created:'2026-04-18', decided:null, amount:'₩5,800,000', reason:null },
    { id:'a5', title:'교직원 교육 참가 신청',                   requester:'u_jung', approver:'u_lead', status:'approved', created:'2026-04-10', decided:'2026-04-11', amount:'—', reason:null },
  ].forEach(r => ins.run(r));
}

if (count('events') === 0) {
  const ins = db.prepare(`INSERT INTO events VALUES (@id,@title,@start_date,@time,@shared,@color,@owner,@desc,@ai,@ai_reason)`);
  [
    { id:'e1', title:'팀 주간회의',              start_date:'2026-04-20', time:'10:00', shared:1, color:'var(--primary)', owner:'u_lead', desc:'이번 주 업무 공유', ai:0, ai_reason:null },
    { id:'e2', title:'행사지원 신청서 마감',      start_date:'2026-04-22', time:'18:00', shared:1, color:'var(--danger)',  owner:'u_me',   desc:'5월 행사 지원 공모', ai:0, ai_reason:null },
    { id:'e3', title:'외부강사 면담',             start_date:'2026-04-23', time:'14:00', shared:0, color:'var(--ink-2)', owner:'u_me',   desc:null, ai:0, ai_reason:null },
    { id:'e4', title:'결산 준비 착수 (AI 제안)',  start_date:'2026-04-28', time:'종일',  shared:1, color:'var(--accent)', owner:'u_me',   desc:'매년 10월 말 결산 업무 착수 패턴 (2022–2025)', ai:1, ai_reason:'매년 10월 말 결산 업무 착수 패턴 (2022–2025)' },
    { id:'e5', title:'평생교육원 전체회의',       start_date:'2026-04-30', time:'15:00', shared:1, color:'var(--primary)', owner:'u_admin',desc:null, ai:0, ai_reason:null },
    { id:'e6', title:'중간 점검',                start_date:'2026-04-15', time:'09:30', shared:1, color:'var(--primary)', owner:'u_lead', desc:null, ai:0, ai_reason:null },
    { id:'e7', title:'AI 워크숍 세미나',          start_date:'2026-04-17', time:'13:00', shared:0, color:'var(--ink-2)', owner:'u_me',   desc:null, ai:0, ai_reason:null },
  ].forEach(r => ins.run(r));
}

if (count('board_posts') === 0) {
  const ins = db.prepare(`INSERT INTO board_posts VALUES (@id,@type,@title,@content,@author,@date,@views,@pinned,@comments_count)`);
  [
    { id:'n1', type:'notice', title:'[필독] 2026년 상반기 조직 개편 안내',       content:'이 공지사항의 내용을 주의 깊게 읽어 주시기 바랍니다. 해당 사항에 대해 궁금한 점이 있으시면 담당자에게 문의하세요.', author:'u_admin', date:'2026-04-18', views:124, pinned:1, comments_count:2 },
    { id:'n2', type:'notice', title:'로컬 AI 서버 정기 점검 공지 (4/25 22:00~)', content:'4월 25일 22시부터 ANG 서버 정기 점검이 진행됩니다. 점검 시간 동안 서비스 이용이 제한됩니다.', author:'u_admin', date:'2026-04-15', views:89, pinned:0, comments_count:0 },
    { id:'n3', type:'notice', title:'연차 사용 촉진 안내',                        content:'5월 중 연차 사용을 권장합니다. 팀장과 협의하여 일정을 조율해 주세요.', author:'u_lead',  date:'2026-04-10', views:56, pinned:0, comments_count:0 },
    { id:'n4', type:'notice', title:'4월 교직원 안전교육 이수 확인',              content:'4월 안전교육 이수 확인 바랍니다. 미이수자는 4월 말까지 완료해 주시기 바랍니다.', author:'u_lead',  date:'2026-04-03', views:102, pinned:0, comments_count:0 },
    { id:'f1', type:'free',   title:'점심 맛집 공유해요',                          content:'근처에 새로 생긴 한식집 추천드려요!', author:'u_park', date:'2026-04-19', views:0, pinned:0, comments_count:12 },
    { id:'f2', type:'free',   title:'구청 앞 주차 가능 위치 아시는 분',           content:'오늘 구청 업무로 차 가져왔는데 주차 팁 공유해주시면 감사합니다.', author:'u_gal',  date:'2026-04-17', views:0, pinned:0, comments_count:4 },
    { id:'f3', type:'free',   title:'이번 달 생일자 축하해요',                     content:'이번 달 생일자 모두 축하드립니다 🎂', author:'u_kim',  date:'2026-04-12', views:0, pinned:0, comments_count:8 },
  ].forEach(r => ins.run(r));
}

if (count('board_comments') === 0) {
  const ins = db.prepare(`INSERT INTO board_comments (post_id, author, text, time) VALUES (@post_id,@author,@text,@time)`);
  [
    { post_id:'n1', author:'u_lead', text:'확인했습니다. 팀원들에게 공유하겠습니다.', time:'09:45' },
    { post_id:'n1', author:'u_kim',  text:'네, 알겠습니다!', time:'10:12' },
    { post_id:'f1', author:'u_gal',  text:'저도 동의합니다 ㅎㅎ', time:'14:30' },
  ].forEach(r => ins.run(r));
}

if (count('chat_rooms') === 0) {
  const ins = db.prepare(`INSERT INTO chat_rooms VALUES (@id,@name,@group_chat,@members,@last,@time,@unread)`);
  [
    { id:'c1', name:'학사운영팀',   group_chat:1, members:JSON.stringify(['u_me','u_lead','u_kim','u_gal','u_park','u_jung']), last:'차팀장: 내일 회의 자료 부탁합니다', time:'14:22', unread:2 },
    { id:'c2', name:'김명자',       group_chat:0, members:JSON.stringify(['u_me','u_kim']),  last:'네 확인했습니다!', time:'13:05', unread:0 },
    { id:'c3', name:'박서진',       group_chat:0, members:JSON.stringify(['u_me','u_park']), last:'강사 일정 공유드려요', time:'11:40', unread:1 },
    { id:'c4', name:'행사지원 TF',  group_chat:1, members:JSON.stringify(['u_me','u_lead','u_park','u_gal']), last:'지원금 상한 확인 필요', time:'어제', unread:0 },
  ].forEach(r => ins.run(r));
}

if (count('chat_messages') === 0) {
  const ins = db.prepare(`INSERT INTO chat_messages (room_id, from_user, text, time) VALUES (@room_id,@from_user,@text,@time)`);
  [
    { room_id:'c1', from_user:'u_lead', text:'이번 주 업무 보고 오전까지 부탁합니다.', time:'09:12' },
    { room_id:'c1', from_user:'u_me',   text:'네, 정리해서 공유드릴게요.', time:'09:14' },
    { room_id:'c1', from_user:'u_kim',  text:'저는 완료했습니다 👍', time:'10:02' },
    { room_id:'c1', from_user:'u_park', text:'신청서는 AI 초안 받고 검토 중입니다.', time:'13:41' },
    { room_id:'c1', from_user:'u_lead', text:'내일 회의 자료 부탁합니다', time:'14:22' },
    { room_id:'c2', from_user:'u_me',   text:'명자씨, 서류 확인 부탁드려요.', time:'12:50' },
    { room_id:'c2', from_user:'u_kim',  text:'네 확인했습니다!', time:'13:05' },
    { room_id:'c3', from_user:'u_park', text:'강사 일정 공유드려요', time:'11:40' },
    { room_id:'c4', from_user:'u_lead', text:'행사 지원금 상한 확인해주세요.', time:'어제' },
    { room_id:'c4', from_user:'u_gal',  text:'지원금 상한 확인 필요', time:'어제' },
  ].forEach(r => ins.run(r));
}

if (count('mails') === 0) {
  const ins = db.prepare(`INSERT INTO mails VALUES (@id,@from_user,@subject,@preview,@time,@unread,@starred,@has_attach,@trashed)`);
  [
    { id:'m1', from_user:'u_lead',  subject:'주간 업무 보고 양식 공유',    preview:'다음 주부터 새 양식으로 제출 바랍니다...', time:'10:24', unread:1, starred:0, has_attach:1, trashed:0 },
    { id:'m2', from_user:'u_admin', subject:'[안내] 시스템 정기 점검',     preview:'4월 25일 22시부터 ANG 서버 점검...', time:'어제', unread:1, starred:1, has_attach:0, trashed:0 },
    { id:'m3', from_user:'u_park',  subject:'외부강사 계약서 초안 회람',   preview:'수정 의견 주시면 반영하겠습니다...', time:'어제', unread:0, starred:0, has_attach:1, trashed:0 },
    { id:'m4', from_user:'u_jung',  subject:'설문 결과 공유드립니다',      preview:'총 응답 214건 / 만족도 4.3...', time:'2일 전', unread:0, starred:1, has_attach:1, trashed:0 },
    { id:'m5', from_user:'u_kim',   subject:'강의실 예약 승인 완료',        preview:'요청하신 202호 예약 처리 완료...', time:'3일 전', unread:0, starred:0, has_attach:0, trashed:0 },
  ].forEach(r => ins.run(r));
}

if (count('sent_mails') === 0) {
  const ins = db.prepare(`INSERT INTO sent_mails VALUES (@id,@to_user,@subject,@preview,@time,@has_attach)`);
  [
    { id:'s1', to_user:'차무식 팀장', subject:'주간 업무 보고 (4월 3주차)', preview:'이번 주 업무 진행상황 보고드립니다.', time:'09:30', has_attach:0 },
    { id:'s2', to_user:'최선호 원장', subject:'행사지원 서류 제출 안내',    preview:'4월 행사 지원 서류 첨부하여 제출드립니다.', time:'어제', has_attach:1 },
  ].forEach(r => ins.run(r));
}

if (count('tasks') === 0) {
  const ins = db.prepare(`INSERT INTO tasks VALUES (@id,@title,@col,@assignee,@due,@tag,@priority)`);
  [
    { id:'t1', title:'행사지원 신청서 초안 작성', col:'doing', assignee:'u_me',   due:'04.22', tag:'신청서', priority:'high' },
    { id:'t2', title:'외부강사 명단 확인',         col:'todo',  assignee:'u_me',   due:'04.25', tag:'공문',  priority:'mid' },
    { id:'t3', title:'수강생 설문 집계 정리',      col:'doing', assignee:'u_jung', due:'04.24', tag:'설문',  priority:'mid' },
    { id:'t4', title:'강의실 예약 승인 처리',      col:'done',  assignee:'u_kim',  due:'04.18', tag:'운영',  priority:'low' },
    { id:'t5', title:'예산 결산 자료 취합',        col:'todo',  assignee:'u_gal',  due:'04.30', tag:'예산',  priority:'high' },
    { id:'t6', title:'워크숍 장소 답사',           col:'doing', assignee:'u_park', due:'04.26', tag:'행사',  priority:'mid' },
    { id:'t7', title:'공문 수신 확인',             col:'done',  assignee:'u_park', due:'04.17', tag:'공문',  priority:'low' },
  ].forEach(r => ins.run(r));
}

export default db;
