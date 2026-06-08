# 📡 ANG 시스템 API 기능 명세서

## 1. 인증 및 계정 (Authentication)
| Method | Endpoint | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | 로그인 및 토큰 발급 | empNo, password 필요 |
| POST | `/api/auth/register` | 회원가입 신청 | 승인 대기 상태로 등록 |
| POST | `/api/auth/refresh` | JWT 토큰 갱신 | Refresh Token 사용 |
| POST | `/api/auth/logout` | 로그아웃 | 토큰 무효화 |

---

## 2. 관리자 기능 (Admin)
| Method | Endpoint | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| GET | `/api/admin/users/pending` | 가입 승인 대기자 목록 조회 | Lv 50 이상 권한 필요 |
| PATCH | `/api/admin/users/{id}/approve` | 가입 승인 및 권한 부여 | |
| PATCH | `/api/admin/users/{id}/reject` | 가입 거절 | 사유 입력 포함 |
| GET | `/api/admin/users` | 전체 사용자 목록 조회 | 다중 소속 정보 포함 |
| PATCH | `/api/admin/users/{id}/role` | 사용자 시스템 권한 변경 | |
| DELETE | `/api/admin/users/{id}` | 사용자 퇴사 처리 | 익명화 및 삭제 |

---

## 3. 문서 관리 (Documents)
| Method | Endpoint | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| GET | `/api/documents/my` | 내 개인 문서 목록 조회 | |
| GET | `/api/documents/department` | 부서 공유 문서 목록 조회 | L2 계층 공유 로직 적용 |
| POST | `/api/documents` | 신규 문서 업로드 | Multipart File 사용 |
| GET | `/api/documents/{id}` | 문서 상세 정보 조회 | |
| GET | `/api/documents/{id}/download` | 원본 파일 다운로드 | |
| POST | `/api/documents/ai-generate` | AI 기반 문서 생성 | LLM 연동 |
| DELETE | `/api/documents/{id}` | 문서 삭제 | 휴지통 이동 |

---

## 4. 메일 시스템 (Mail)
| Method | Endpoint | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| GET | `/api/mail/inbox` | 받은 메일함 조회 | |
| GET | `/api/mail/sent` | 보낸 메일함 조회 | |
| POST | `/api/mail` | 메일 발송 | 파일 첨부 지원 |
| GET | `/api/mail/{id}` | 메일 상세 조회 | 읽음 처리 자동 수행 |
| POST | `/api/mail/draft` | 메일 임시 저장 | |
| DELETE | `/api/mail/{id}/inbox` | 받은 메일 삭제 | 휴지통 이동 |
| POST | `/api/mail/{id}/cancel` | 발송 취소 | 상대방 읽기 전만 가능 |

---

## 5. 일정 및 조직 (Schedule & Scope)
| Method | Endpoint | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| GET | `/api/schedules` | 일정 목록 조회 | 기간 필터 지원 |
| POST | `/api/schedules` | 일정 등록 | |
| GET | `/api/schedules/ai-recommendations` | AI 일정 추천 | 작년 동기 데이터 기반 |
| GET | `/api/scopes` | 조직도 트리 조회 | 전체 계층 구조 |
| POST | `/api/scopes/{id}/members` | 부서 멤버 추가 | 다중 소속 설정 시 사용 |

---

## 6. 기타 기능 (Misc)
| Method | Endpoint | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| GET | `/api/memos` | 개인 메모 조회 | 대시보드 위젯용 |
| POST | `/api/memos` | 메모 작성 | |
| GET | `/api/chat/rooms` | 참여 중인 채팅방 목록 | |
| POST | `/api/chat/rooms` | 채팅방 생성 | 1:1 또는 그룹 |
| GET | `/api/health` | 서버 상태 체크 | 헬스체크용 |
