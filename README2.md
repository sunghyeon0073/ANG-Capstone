# 📑 [ANG 시스템] 최종 API 명세서

### 1. 문서(Document) 관리 API
| 기능명 | 메서드 | 엔드포인트 | 파라미터(Query/Body) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| 부서 문서 조회 | GET | `/documents/department` | `scopeId`(선택), `keyword`(선택) | **[핵심]** 부서별 문서 목록 조회 (보안 검증 포함) |
| 내 문서 조회 | GET | `/documents/my` | - | 개인 전용 문서함 조회 |
| 전체 문서 조회 | GET | `/documents` | - | 시스템 전체 문서 (관리자용) |
| 문서 상세 조회 | GET | `/documents/{id}` | - | 문서 상세 내용 및 파일 정보 |
| 문서 업로드 | POST | `/documents` | `title`, `file`(Multipart), `targetScopeId` | 수동 문서 생성 및 파일 업로드 |
| AI 문서 생성 | POST | `/documents/ai-generate` | `prompt` | AI를 통한 자동 문서 생성 및 저장 |

### 2. 조직/부서(Scope) 관리 API
| 기능명 | 메서드 | 엔드포인트 | 파라미터(Query/Body) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| 내 부서 리스트 | GET | `/scopes/my` | - | **[신규]** 사이드바용 소속 부서 목록 |
| 전체 조직 조회 | GET | `/scopes` | - | 전사 조직도 트리 구성용 |
| 조직 생성 | POST | `/scopes` | `name`, `type`, `scopeCode`, `parentId` | 부서 생성 (물리 폴더 자동 생성) |
| 부서원 추가 | POST | `/scopes/{id}/members` | `userId`(Query) | **[신규]** 다중 부서 소속 처리 (보안 검증) |
| 부서원 조회 | GET | `/scopes/{id}/members` | - | 해당 부서에 속한 직원 목록 |

### 3. 사용자(User) 및 승인 API
| 기능명 | 메서드 | 엔드포인트 | 파라미터(Query/Body) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| 가입 승인 | POST | `/users/{id}/approve` | `roleLevel`(0:일반, 50:관리자) | **[신규]** 대기 유저 활성화 및 권한 부여 |
| 사용자 목록 | GET | `/users` | - | 전체 직원 명부 |
| 정보 수정 | PATCH | `/users/{id}` | `name`, `email`, `profileImageUrl` 등 | 프로필 정보 수정 |

### 4. 파일(File) 서비스 API
| 기능명 | 메서드 | 엔드포인트 | 파라미터(Query/Body) | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| 파일 다운로드 | GET | `/files/download/{fileId}` | - | 실제 물리 파일 내려받기 |

---

### 🏗️ 시스템 자동화 및 보안 정책 (백엔드 내부 로직)

* **실시간 동기화 (WatchService):**
    * `uploads/Scopes/{부서코드}/` → 파일 추가/삭제 시 해당 부서 문서로 즉시 반영
    * `uploads/Users/{사번}/` → 파일 추가/삭제 시 개인 문서함으로 즉시 반영
* **물리 폴더 자동 생성:**
    * 부서 생성, 사용자 가입, 서버 시작 시(기존 데이터) 누락된 물리 폴더를 자동으로 생성합니다.
* **강력한 보안:**
    * 모든 부서 문서 조회 시, 사용자가 해당 부서의 멤버인지 혹은 상위 부서 관리자인지 실시간으로 권한을 체크합니다.
