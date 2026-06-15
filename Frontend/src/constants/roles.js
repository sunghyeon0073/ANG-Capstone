export const ROLE_LEVELS = [
  { label: '일반 사용자 (Lv 1)', value: 1 },
  { label: '중간 관리자 (Lv 50)', value: 50 },
  { label: '최고 관리자 (Lv 100)', value: 100 },
]

export const POSITIONS = ['사원', '대리', '과장', '차장', '부장', '팀장', '센터장', '원장']

export const roleBadgeStyle = (level) => ({
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
  background: level >= 100 ? '#fff1f0' : level >= 50 ? '#e6f7ff' : '#f6ffed',
  color:      level >= 100 ? '#cf1322' : level >= 50 ? '#096dd9' : '#389e0d',
  border:     level >= 100 ? '1px solid #ffa39e' : level >= 50 ? '1px solid #91d5ff' : '1px solid #b7eb8f',
})
