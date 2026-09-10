// AI 백엔드(Ollama 서버)가 응답하지 않을 때 사용하는 데모 폴백 생성기.
// Modelfile의 SYSTEM 규칙(문서 유형별 구조, 표 규칙, 자리표시자 표기)과 동일한 형식으로
// 프론트엔드에서 임시 문서를 만들어 화면 흐름(진행바 → 미리보기 → 요약)을 이어간다.
// 실제 서버가 살아있으면 이 파일은 전혀 호출되지 않는다 (AiGenerationContext 참고).

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const DOC_TYPE_TEMPLATES = [
  {
    key: 'notice',
    label: '공지문',
    keywords: ['공지', '안내문', '알림'],
    sections: ['목적/배경', '세부 내용', '일정', '대상', '문의/후속 조치'],
  },
  {
    key: 'proposal',
    label: '제안서',
    keywords: ['제안서', '제안'],
    sections: ['목적', '현황', '제안 내용', '기대 효과', '추진 일정', '필요 지원'],
  },
  {
    key: 'plan',
    label: '기획서',
    keywords: ['기획서', '기획안', '기획'],
    sections: ['개요/목적', '추진 배경', '추진 내용', '일정', '예산', '위험 요소 및 대응', '기대 효과'],
  },
  {
    key: 'minutes',
    label: '회의록',
    keywords: ['회의록', '회의 내용', '미팅노트'],
    sections: ['회의 정보', '참석자', '안건', '논의 내용', '결정 사항', '액션 아이템'],
  },
  {
    key: 'approval',
    label: '결재/요청',
    keywords: ['결재', '승인 요청', '품의'],
    sections: ['목적', '요청 내용', '근거', '기대 효과', '승인 요청'],
  },
  {
    key: 'report',
    label: '보고서',
    keywords: ['보고서', '보고'],
    sections: ['요약', '배경', '주요 내용', '문제점/위험', '제안', '후속 조치'],
  },
]

const DEFAULT_TEMPLATE = DOC_TYPE_TEMPLATES[DOC_TYPE_TEMPLATES.length - 1]

function detectDocType(prompt = '') {
  return DOC_TYPE_TEMPLATES.find((tpl) => tpl.keywords.some((kw) => prompt.includes(kw))) || DEFAULT_TEMPLATE
}

const TRAILING_REQUEST_PHRASES = /\s*(작성해\s*줘|작성해줘|작성해\s*주세요|만들어\s*줘|만들어줘|만들어\s*주세요|부탁(해요|드립니다|해)?|해\s*주세요)\s*\.?\s*$/

function extractTitle(prompt = '', fallbackLabel) {
  const firstLine = prompt.split('\n')[0].trim()
  const cleaned = firstLine.replace(TRAILING_REQUEST_PHRASES, '').trim()
  if (cleaned.length >= 2 && cleaned.length <= 40) return cleaned
  return fallbackLabel
}

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const SECTION_PLACEHOLDER_HINTS = {
  '일정': '[일자]',
  '예산': '[금액]',
  '담당자': '[담당자]',
  '대상': '[부서]',
  '참석자': '[담당자]',
}

function buildSectionBody(sectionName, prompt) {
  const hint = Object.entries(SECTION_PLACEHOLDER_HINTS).find(([key]) => sectionName.includes(key))
  if (hint) {
    return `${sectionName}은(는) ${hint[1]} 확인 후 반영 예정입니다.`
  }
  const trimmedPrompt = prompt.replace(/\s+/g, ' ').trim()
  const context = trimmedPrompt.length > 60 ? `${trimmedPrompt.slice(0, 60)}...` : trimmedPrompt
  return `요청하신 내용("${context}")을 바탕으로 ${sectionName}을(를) 정리했습니다. 세부 확정 사항은 [담당자] 검토 후 갱신됩니다.`
}

function buildMockDocxDocument({ title, docType, prompt, mode }) {
  const sections = docType.sections
    .map((section) => `
      <h2>${escapeHtml(section)}</h2>
      <p>${escapeHtml(buildSectionBody(section, prompt))}</p>
    `)
    .join('\n')

  const editNotice = mode === 'edit'
    ? '<p class="mock-docx-edit-note">요청하신 수정 사항을 반영한 버전입니다.</p>'
    : ''

  const mockPreviewHtml = `
    <div class="mock-docx-page">
      <h1># ${escapeHtml(title)}</h1>
      ${editNotice}
      ${sections}
    </div>
  `

  return { title: `${title}.docx`, mockPreviewHtml }
}

const XLSX_COLUMN_SETS = {
  minutes: ['안건', '논의 내용', '결정 사항', '담당자', '기한'],
  plan: ['추진 항목', '내용', '담당자', '일정', '예산'],
  proposal: ['항목', '제안 내용', '기대 효과', '담당자', '일정'],
  default: ['항목', '내용', '담당자', '일정', '비고'],
}

function buildMockXlsxDocument({ title, docType, mode }) {
  const headers = XLSX_COLUMN_SETS[docType.key] || XLSX_COLUMN_SETS.default
  const rowCount = 4
  const rows = Array.from({ length: rowCount }, (_, index) => (
    headers.map((header, colIndex) => {
      if (colIndex === 0) return `${docType.label} 항목 ${index + 1}`
      if (header.includes('담당자')) return '[담당자]'
      if (header.includes('일정') || header.includes('기한')) return '[일자]'
      if (header.includes('예산')) return '[금액]'
      return '[내용]'
    })
  ))

  const titleSuffix = mode === 'edit' ? ' (수정본)' : ''
  return { title: `${title}${titleSuffix}.xlsx`, mockTableData: { headers, rows } }
}

let mockDocSequence = 0

export async function generateMockDocument(payload, meta = {}) {
  const { prompt = '', outputFormat = 'docx', mode = 'create' } = payload || {}
  const docType = detectDocType(prompt)
  const fallbackLabel = meta.sourceDocTitle
    ? meta.sourceDocTitle.replace(/\.[^./]+$/, '')
    : docType.label
  const title = extractTitle(prompt, fallbackLabel)

  // 실제 모델 추론과 비슷한 체감 시간을 위한 지연 (진행바 연출과 자연스럽게 맞물림)
  await sleep(1500 + Math.random() * 1500)

  const built = outputFormat === 'xlsx'
    ? buildMockXlsxDocument({ title, docType, mode })
    : buildMockDocxDocument({ title, docType, prompt, mode })

  mockDocSequence += 1
  const now = new Date().toISOString()

  return {
    docId: -(Date.now() * 1000 + mockDocSequence),
    title: built.title,
    originalContent: null,
    aiSummary: `"${title}" 생성이 완료되었습니다. 문서함에서 결과를 확인해 주세요.`,
    status: 'ACTIVE',
    originalFileName: null,
    fileId: null,
    fileContentType: null,
    fileSize: null,
    previewFileId: null,
    previewFileContentType: null,
    ownerName: null,
    ownerId: null,
    scopeName: 'N/A',
    scopeId: null,
    createdAt: now,
    deletedAt: null,
    canDelete: true,
    isFavorite: false,
    changes: [],
    mockPreviewHtml: built.mockPreviewHtml,
    mockTableData: built.mockTableData,
  }
}
