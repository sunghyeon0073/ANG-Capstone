// Mock data for the ANG prototype.
// All names are fictional for this prototype.

export const USERS = [
  { id: 'u_me',   name: '이상열', role: '일반', rank: '주임', emp: '2024-0143', dept: '학사운영팀', avatar: 'LS', color: 'oklch(0.72 0.08 195)' },
  { id: 'u_lead', name: '차무식', role: '팀장', rank: '팀장', emp: '2018-0021', dept: '학사운영팀', avatar: 'CM', color: 'oklch(0.72 0.08 30)' },
  { id: 'u_kim',  name: '김명자', role: '일반', rank: '조교', emp: '2025-0078', dept: '학사운영팀', avatar: 'KM', color: 'oklch(0.72 0.08 145)' },
  { id: 'u_gal',  name: '갈명순', role: '일반', rank: '사원', emp: '2023-0056', dept: '학사운영팀', avatar: 'GM', color: 'oklch(0.72 0.08 300)' },
  { id: 'u_park', name: '박서진', role: '일반', rank: '주임', emp: '2022-0018', dept: '학사운영팀', avatar: 'PS', color: 'oklch(0.72 0.08 250)' },
  { id: 'u_jung', name: '정하린', role: '일반', rank: '사원', emp: '2025-0091', dept: '학사운영팀', avatar: 'JH', color: 'oklch(0.72 0.08 90)' },
  { id: 'u_admin',name: '최선호', role: '최고관리자', rank: '원장', emp: '2010-0001', dept: '평생교육원', avatar: 'CS', color: 'oklch(0.60 0.10 15)' },
];

export const DEPTS = [
  { id: 'd_edu',  name: '평생교육원', parent: null, head: 'u_admin' },
  { id: 'd_haksa',name: '학사운영팀', parent: 'd_edu', head: 'u_lead' },
  { id: 'd_event',name: '기획행사팀', parent: 'd_edu', head: null },
  { id: 'd_budget',name:'예산운영팀', parent: 'd_edu', head: null },
];

export const DOCS = [
  { id:'doc_1', title:'2024년 상반기 평생교육원 행사지원 신청서', type:'신청서', year:2024, author:'u_kim', updated:'2024-05-12', ext:'hwp', tags:['행사','지원금'], size:'68 KB', score: 0.94 },
  { id:'doc_2', title:'2023년 상반기 평생교육원 행사지원 신청서', type:'신청서', year:2023, author:'u_lead', updated:'2023-05-02', ext:'hwp', tags:['행사','지원금'], size:'64 KB', score: 0.88 },
  { id:'doc_3', title:'2025년 상반기 평생교육원 행사지원 신청서', type:'신청서', year:2025, author:'u_park', updated:'2025-05-04', ext:'docx', tags:['행사','지원금'], size:'72 KB', score: 0.92 },
  { id:'doc_4', title:'2024년 하반기 결산 보고서', type:'보고서', year:2024, author:'u_lead', updated:'2024-12-10', ext:'pdf', tags:['결산','예산'], size:'312 KB', score: 0.61 },
  { id:'doc_5', title:'2024 교직원 워크숍 계획안', type:'계획안', year:2024, author:'u_gal', updated:'2024-09-03', ext:'docx', tags:['워크숍','계획'], size:'128 KB', score: 0.55 },
  { id:'doc_6', title:'외부강사 초빙 공문 (2025)', type:'공문', year:2025, author:'u_park', updated:'2025-03-14', ext:'hwp', tags:['공문','강사'], size:'42 KB', score: 0.48 },
  { id:'doc_7', title:'2024 하반기 수강생 설문조사 결과', type:'보고서', year:2024, author:'u_jung', updated:'2024-11-28', ext:'pdf', tags:['설문','수강생'], size:'1.2 MB', score: 0.43 },
  { id:'doc_8', title:'강의실 예약 양식 템플릿', type:'양식', year:2025, author:'u_kim', updated:'2025-02-01', ext:'docx', tags:['양식','강의실'], size:'22 KB', score: 0.38 },
];

export const TODAY = new Date(2026, 3, 20); // Apr 20, 2026 (month is 0-indexed)
export const d = (y,m,day) => new Date(y, m-1, day);

export const EVENTS = [
  { id:'e1', title:'팀 주간회의', start: d(2026,4,20), time:'10:00', end:'11:00', shared:true, color:'var(--primary)', owner:'u_lead', desc:'이번 주 업무 공유' },
  { id:'e2', title:'행사지원 신청서 마감', start: d(2026,4,22), time:'18:00', shared:true, color:'var(--danger)', owner:'u_me', desc:'5월 행사 지원 공모' },
  { id:'e3', title:'외부강사 면담', start: d(2026,4,23), time:'14:00', shared:false, color:'var(--ink-2)', owner:'u_me' },
  { id:'e4', title:'결산 준비 착수 (AI 제안)', start: d(2026,4,28), time:'종일', shared:true, color:'var(--accent)', owner:'u_me', ai:true, aiReason:'매년 10월 말 결산 업무 착수 패턴 (2022–2025)'},
  { id:'e5', title:'평생교육원 전체회의', start: d(2026,4,30), time:'15:00', shared:true, color:'var(--primary)', owner:'u_admin' },
  { id:'e6', title:'중간 점검', start: d(2026,4,15), time:'09:30', shared:true, color:'var(--primary)', owner:'u_lead' },
  { id:'e7', title:'AI 워크숍 세미나', start: d(2026,4,17), time:'13:00', shared:false, color:'var(--ink-2)', owner:'u_me' },
];

export const TASKS = [
  { id:'t1', title:'행사지원 신청서 초안 작성',  col:'doing', assignee:'u_me',   due:'04.22', tag:'신청서', priority:'high' },
  { id:'t2', title:'외부강사 명단 확인',           col:'todo',  assignee:'u_me',   due:'04.25', tag:'공문',  priority:'mid' },
  { id:'t3', title:'수강생 설문 집계 정리',        col:'doing', assignee:'u_jung', due:'04.24', tag:'설문',  priority:'mid' },
  { id:'t4', title:'강의실 예약 승인 처리',        col:'done',  assignee:'u_kim',  due:'04.18', tag:'운영',  priority:'low' },
  { id:'t5', title:'예산 결산 자료 취합',          col:'todo',  assignee:'u_gal',  due:'04.30', tag:'예산',  priority:'high' },
  { id:'t6', title:'워크숍 장소 답사',             col:'doing', assignee:'u_park', due:'04.26', tag:'행사',  priority:'mid' },
  { id:'t7', title:'공문 수신 확인',               col:'done',  assignee:'u_park', due:'04.17', tag:'공문',  priority:'low' },
];

export const APPROVALS = [
  { id:'a1', title:'행사지원 신청서 (5월 평생교육 페스티벌)', requester:'u_me',   approver:'u_lead', status:'pending',  created:'2026-04-19', amount:'₩4,200,000' },
  { id:'a2', title:'외부강사 초빙 요청 (김민수)',            requester:'u_park', approver:'u_lead', status:'approved', created:'2026-04-16', decided:'2026-04-17', amount:'₩800,000' },
  { id:'a3', title:'3월 비품 구매 품의',                     requester:'u_kim',  approver:'u_lead', status:'rejected', created:'2026-04-12', decided:'2026-04-13', amount:'₩1,150,000', reason:'견적서 재첨부 필요' },
  { id:'a4', title:'하반기 워크숍 예산안',                   requester:'u_gal',  approver:'u_lead', status:'pending',  created:'2026-04-18', amount:'₩5,800,000' },
  { id:'a5', title:'교직원 교육 참가 신청',                   requester:'u_jung', approver:'u_lead', status:'approved', created:'2026-04-10', decided:'2026-04-11', amount:'—' },
];

export const BOARDS = {
  notice: [
    { id:'n1', title:'[필독] 2026년 상반기 조직 개편 안내',  author:'u_admin', date:'2026-04-18', views:124, pinned:true },
    { id:'n2', title:'로컬 AI 서버 정기 점검 공지 (4/25 22:00~)', author:'u_admin', date:'2026-04-15', views:89 },
    { id:'n3', title:'연차 사용 촉진 안내',                    author:'u_lead',  date:'2026-04-10', views:56 },
    { id:'n4', title:'4월 교직원 안전교육 이수 확인',          author:'u_lead',  date:'2026-04-03', views:102 },
  ],
  free: [
    { id:'f1', title:'점심 맛집 공유해요 🍜',         author:'u_park', date:'2026-04-19', comments:12 },
    { id:'f2', title:'구청 앞 주차 가능 위치 아시는 분', author:'u_gal',  date:'2026-04-17', comments:4 },
    { id:'f3', title:'이번 달 생일자 축하해요',        author:'u_kim',  date:'2026-04-12', comments:8 },
  ]
};

export const CHATS = [
  { id:'c1', name:'학사운영팀', members:['u_me','u_lead','u_kim','u_gal','u_park','u_jung'], group:true, last:'차팀장: 내일 회의 자료 부탁합니다', unread:2, time:'14:22' },
  { id:'c2', name:'김명자', members:['u_me','u_kim'], group:false, last:'네 확인했습니다!', unread:0, time:'13:05' },
  { id:'c3', name:'박서진', members:['u_me','u_park'], group:false, last:'강사 일정 공유드려요', unread:1, time:'11:40' },
  { id:'c4', name:'행사지원 TF', members:['u_me','u_lead','u_park','u_gal'], group:true, last:'지원금 상한 확인 필요', unread:0, time:'어제' },
];

export const CHAT_MESSAGES = {
  c1: [
    { from:'u_lead', text:'이번 주 업무 보고 오전까지 부탁합니다.', time:'09:12' },
    { from:'u_me',   text:'네, 정리해서 공유드릴게요.', time:'09:14' },
    { from:'u_kim',  text:'저는 완료했습니다 👍', time:'10:02' },
    { from:'u_park', text:'신청서는 AI 초안 받고 검토 중입니다.', time:'13:41' },
    { from:'u_lead', text:'내일 회의 자료 부탁합니다', time:'14:22' },
  ]
};

export const MAILS = [
  { id:'m1', from:'u_lead',  subject:'주간 업무 보고 양식 공유',     preview:'다음 주부터 새 양식으로 제출 바랍니다...', time:'10:24', unread:true,  starred:false, hasAttach:true },
  { id:'m2', from:'u_admin', subject:'[안내] 시스템 정기 점검',      preview:'4월 25일 22시부터 ANG 서버 점검...', time:'어제', unread:true,  starred:true,  hasAttach:false },
  { id:'m3', from:'u_park',  subject:'외부강사 계약서 초안 회람',    preview:'수정 의견 주시면 반영하겠습니다...', time:'어제', unread:false, starred:false, hasAttach:true },
  { id:'m4', from:'u_jung',  subject:'설문 결과 공유드립니다',       preview:'총 응답 214건 / 만족도 4.3...',    time:'2일 전', unread:false, starred:true,  hasAttach:true },
  { id:'m5', from:'u_kim',   subject:'강의실 예약 승인 완료',         preview:'요청하신 202호 예약 처리 완료...',   time:'3일 전', unread:false, starred:false, hasAttach:false },
];

export const NOTIFICATIONS = [
  { id:'n_a1', type:'approval', text:'차무식 팀장이 결재 반려했습니다: 3월 비품 구매 품의', time:'10분 전', unread:true },
  { id:'n_a2', type:'ai',       text:'AI가 반복 업무 "결산 준비" 착수 시점을 제안했습니다', time:'1시간 전', unread:true },
  { id:'n_c1', type:'chat',     text:'차무식 팀장이 메시지를 보냈습니다', time:'2시간 전', unread:true },
  { id:'n_m1', type:'mail',     text:'새 메일 2건이 도착했습니다', time:'오늘 오전', unread:false },
  { id:'n_a3', type:'approval', text:'차무식 팀장이 결재 승인했습니다: 외부강사 초빙 요청', time:'어제', unread:false },
];

export const userById = (id) => USERS.find(u => u.id === id) || USERS[0];
export const fmtDate = (dt) => `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
