const daysAgo = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export const MOCK_SCOPES = [
  { id: 101, name: '개발팀' },
  { id: 102, name: '인사팀' },
]

const DOCX_PREVIEW_HTML = `
<h3>협업 가이드</h3>
<p>그룹웨어 문서 작성 시 팀원과 공유할 협업 규칙을 정리한 문서입니다.</p>
<ul>
  <li>문서 제목은 <strong>부서명 + 주제 + 날짜</strong> 형식을 사용합니다.</li>
  <li>회의록은 24시간 이내에 공유합니다.</li>
  <li>첨부 파일은 PDF·DOCX·XLSX·이미지 형식을 권장합니다.</li>
</ul>
<p>문의: 개발팀 그룹웨어 TF</p>
`.trim()

const EXCEL_Q2_TABLE = {
  headers: ['구분', '1분기', '2분기', '전년 대비'],
  rows: [
    ['매출', '12.4억', '15.1억', '+21.8%'],
    ['신규 고객', '128건', '156건', '+21.9%'],
    ['유지율', '92%', '94%', '+2%p'],
    ['NPS', '41', '47', '+6'],
  ],
}

const EXCEL_BUDGET_TABLE = {
  headers: ['항목', '예산', '집행', '잔액'],
  rows: [
    ['인건비', '45,000,000', '42,300,000', '2,700,000'],
    ['클라우드', '8,000,000', '6,150,000', '1,850,000'],
    ['마케팅', '12,000,000', '9,800,000', '2,200,000'],
    ['교육', '3,000,000', '1,200,000', '1,800,000'],
  ],
}

export const MOCK_MY_DOCUMENTS = [
  {
    docId: 9001,
    title: '2분기 업무 보고서',
    originalContent: `2분기 업무 보고서

1. 주요 성과
- 그룹웨어 문서작성 기능 UI 개선
- AI 문서 초안 생성 기능 프로토타입 완료
- 파일 미리보기(PDF/이미지/DOCX/Excel) 연동

2. 진행 중인 업무
- 부서 문서함 필터링 기능
- 전자결재 연동 검토

3. 다음 분기 계획
- 문서 템플릿 라이브러리 구축
- 협업 코멘트 기능 추가`,
    aiSummary: '2분기 업무 성과 및 다음 분기 계획 요약',
    status: 'DRAFT',
    createdAt: daysAgo(2),
    isMock: true,
  },
  {
    docId: 9002,
    title: '프로젝트 제안서 초안',
    originalContent: `프로젝트 제안서

프로젝트명: 스마트 그룹웨어 고도화
기간: 2026.06 ~ 2026.11
예산: 8,500만원`,
    status: 'DRAFT',
    createdAt: daysAgo(5),
    isMock: true,
  },
  {
    docId: 9003,
    title: '주간 회의록 (5월 17일)',
    originalContent: `주간 회의록

일시: 2026년 5월 17일 14:00
참석: 김개발, 이기획, 박디자인`,
    status: 'DRAFT',
    createdAt: daysAgo(1),
    isMock: true,
  },
  {
    docId: 9004,
    title: '제품 기획안 (PDF)',
    originalFileName: 'product-plan.pdf',
    fileId: 'mock-9004',
    fileContentType: 'application/pdf',
    mockPreviewUrl: '/mock/sample-report.pdf',
    status: 'DRAFT',
    createdAt: daysAgo(7),
    isMock: true,
  },
  {
    docId: 9005,
    title: 'UI 와이어프레임 (PNG)',
    originalFileName: 'wireframe.png',
    fileId: 'mock-9005',
    fileContentType: 'image/png',
    mockPreviewUrl: '/assets/mascot/mascot-idle.png',
    status: 'DRAFT',
    createdAt: daysAgo(3),
    isMock: true,
  },
  {
    docId: 9006,
    title: '협업 가이드 (DOCX)',
    originalFileName: 'collaboration-guide.docx',
    fileId: 'mock-9006',
    fileContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mockPreviewHtml: DOCX_PREVIEW_HTML,
    originalContent: '협업 가이드: 문서 제목 규칙, 회의록 공유, 첨부 파일 형식 안내',
    status: 'DRAFT',
    createdAt: daysAgo(4),
    isMock: true,
  },
  {
    docId: 9007,
    title: '분기별 매출 현황 (Excel)',
    originalFileName: 'q2-sales.xlsx',
    fileId: 'mock-9007',
    fileContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mockTableData: EXCEL_Q2_TABLE,
    originalContent: '2분기 매출 15.1억, 전년 대비 +21.8%. 신규 고객 156건.',
    status: 'DRAFT',
    createdAt: daysAgo(6),
    isMock: true,
  },
  {
    docId: 9008,
    title: '대시보드 스크린샷 (JPG)',
    originalFileName: 'dashboard.jpg',
    fileId: 'mock-9008',
    fileContentType: 'image/jpeg',
    mockPreviewUrl: '/mock/sample-dashboard.svg',
    status: 'DRAFT',
    createdAt: daysAgo(2),
    isMock: true,
  },
  {
    docId: 9009,
    title: '아이콘 에셋 (WEBP)',
    originalFileName: 'icons.webp',
    fileId: 'mock-9009',
    fileContentType: 'image/webp',
    mockPreviewUrl: '/assets/mascot/mascot-idle.png',
    status: 'DRAFT',
    createdAt: daysAgo(9),
    isMock: true,
  },
]

export const MOCK_DEPT_DOCUMENTS = [
  {
    docId: 9101,
    title: '개발팀 스프린트 계획',
    originalContent: `개발팀 스프린트 계획 (Sprint 12)

목표: 문서작성·파일함 UX 통합`,
    scopeId: 101,
    scopeName: '개발팀',
    status: 'DRAFT',
    createdAt: daysAgo(4),
    isMock: true,
  },
  {
    docId: 9102,
    title: '개발팀 코드 리뷰 가이드',
    originalContent: `코드 리뷰 가이드

1. PR은 400줄 이하로 유지
2. UI 변경 시 스크린샷 첨부`,
    scopeId: 101,
    scopeName: '개발팀',
    status: 'DRAFT',
    createdAt: daysAgo(6),
    isMock: true,
  },
  {
    docId: 9103,
    title: '인사팀 온보딩 체크리스트',
    originalContent: `신입사원 온보딩 체크리스트

□ 계정 발급 및 권한 설정
□ 그룹웨어 사용법 안내`,
    scopeId: 102,
    scopeName: '인사팀',
    status: 'DRAFT',
    createdAt: daysAgo(8),
    isMock: true,
  },
  {
    docId: 9104,
    title: '인사팀 휴가 정책 안내',
    originalFileName: 'vacation-policy.pdf',
    fileId: 'mock-9104',
    fileContentType: 'application/pdf',
    mockPreviewUrl: '/mock/sample-report.pdf',
    scopeId: 102,
    scopeName: '인사팀',
    status: 'DRAFT',
    createdAt: daysAgo(10),
    isMock: true,
  },
  {
    docId: 9105,
    title: '개발팀 API 명세 (DOCX)',
    originalFileName: 'api-spec.docx',
    fileId: 'mock-9105',
    fileContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mockPreviewHtml: `
<h3>API 명세 v1.2</h3>
<p><strong>Base URL:</strong> /api</p>
<ul>
  <li>GET /documents/my — 내 문서 목록</li>
  <li>GET /documents/department — 부서 문서 목록</li>
  <li>POST /documents/ai-generate — AI 문서 생성</li>
</ul>
    `.trim(),
    originalContent: 'API 명세: documents, files, scopes 엔드포인트 정리',
    scopeId: 101,
    scopeName: '개발팀',
    status: 'DRAFT',
    createdAt: daysAgo(3),
    isMock: true,
  },
  {
    docId: 9106,
    title: '인사팀 예산 집행표 (Excel)',
    originalFileName: 'hr-budget.xlsx',
    fileId: 'mock-9106',
    fileContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mockTableData: EXCEL_BUDGET_TABLE,
    originalContent: '인사팀 예산 집행: 인건비 94%, 클라우드 77% 집행',
    scopeId: 102,
    scopeName: '인사팀',
    status: 'DRAFT',
    createdAt: daysAgo(5),
    isMock: true,
  },
  {
    docId: 9107,
    title: '조직도 캡처 (PNG)',
    originalFileName: 'org-chart.png',
    fileId: 'mock-9107',
    fileContentType: 'image/png',
    mockPreviewUrl: '/mock/sample-dashboard.svg',
    scopeId: 102,
    scopeName: '인사팀',
    status: 'DRAFT',
    createdAt: daysAgo(7),
    isMock: true,
  },
]

export const getMockDocuments = (category, scopeId = 'all') => {
  if (category === 'my') {
    return MOCK_MY_DOCUMENTS
  }

  if (scopeId === 'all') {
    return MOCK_DEPT_DOCUMENTS
  }

  return MOCK_DEPT_DOCUMENTS.filter((doc) => String(doc.scopeId) === String(scopeId))
}

export const mergeWithMockDocuments = (apiDocs, category, scopeId = 'all') => {
  if (!isDevMockEnabled()) return apiDocs

  const mocks = getMockDocuments(category, scopeId)
  const apiIds = new Set(apiDocs.map((doc) => doc.docId))
  const uniqueMocks = mocks.filter((doc) => !apiIds.has(doc.docId))
  return [...uniqueMocks, ...apiDocs]
}

export const isDevMockEnabled = () => import.meta.env.DEV
