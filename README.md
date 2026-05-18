# 🚀 ANG (Admin Next Generation) 시스템 기술 명세서

이 문서는 시스템의 핵심 비즈니스 로직, 데이터 구조, 그리고 프론트엔드 API 연동을 위한 상세 가이드를 포함합니다.

---

## 🧠 핵심 비즈니스 로직 (Core Business Logic)

### 1. 조직 체계 및 계층 구조 (Organizational Hierarchy)
시스템은 최대 3단계의 계층 구조를 가집니다.
- **Level 1 (COMPANY):** 최상위 기관 (예: 영진전문대학교)
- **Level 2 (DEPARTMENT):** 중간 부서 (예: 평생교육원) - **핵심 권한 단위**
- **Level 3 (TEAM):** 하위 실무 팀 (예: 장기요양교육센터, 행정지원팀 등)

### 2. 문서 열람 권한 로직 (Document Access Rules)
단순한 부서 소속 여부가 아닌, **상위 부서(Level 2) 기준**으로 권한이 결정됩니다.
- **로직:** 특정 사용자가 문서를 조회할 때, 사용자의 소속 부서의 **'Level 2 조상 부서'**를 찾습니다.
- **허용 범위:** 동일한 Level 2 조상 부서를 공유하는 모든 사용자는 서로의 문서를 열람할 수 있습니다.
  - *예: '장기요양교육센터(L3)' 직원은 '행정지원(L3)' 직원의 문서를 볼 수 있음 (둘 다 '평생교육원(L2)' 산아이기 때문)*
  - *예: '평생교육원(L2)' 원장은 산하 모든 L3 팀의 문서를 열람 가능*
- **업로드:** 파일 업로드 시에는 반드시 특정 실무 팀(Level 3) 또는 부서(Level 2)를 지정해야 하며, 파일은 해당 부서의 고유 코드 폴더(`uploads/Scopes/{code}`)에 물리적으로 저장됩니다.

### 3. 사용자 가입 및 승인 워크플로우 (User Lifecycle)
- **회원가입:** 사용자는 본인이 속한 **가장 구체적인 부서 코드(L2 또는 L3)** 하나를 입력하여 가입합니다.
- **승인 대기:** 가입 직후 상태는 `PENDING`이며 로그인이 불가능합니다.
- **관리자 승인:** 최고관리자는 대기 명단에서 다음 항목을 지정하여 승인합니다.
  - **시스템 권한(Role Level):** 1(일반), 50(관리자), 100(최고관리자)
  - **직급(Position):** 사원, 팀장, 원장 등 (문자열)
- **거절:** 거절 시 사유를 입력하며, 해당 사용자는 상태가 `REJECTED`로 변경됩니다.

### 4. 다중 소속 및 직급 관리 (Multi-Department Support)
한 사용자는 여러 부서에 동시에 소속될 수 있습니다. (`UserMembership` 기반)
- 각 소속 부서마다 **서로 다른 직급**을 가질 수 있습니다.
- 관리자 페이지에서 기존 소속 외에 새로운 부서를 추가하거나, 특정 부서의 직급만 수정하는 것이 가능합니다.

---

## 📡 API 상세 명세서

### 🔓 인증 (Authentication)
| Method | Endpoint | Description | Payload | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | 로그인 | `{ "empNo": "admin", "password": "..." }` | JWT(AccessToken, RefreshToken) 반환 |
| `POST` | `/auth/register` | 회원가입 | `{ "name", "empNo", "birthdate", "email", "password", "passwordConfirm", "scopeCode" }` | `scopeCode`는 조직도 내 고유 코드 |

### 👑 관리자 (Admin Management)
| Method | Endpoint | Description | Payload / Params | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/users/pending` | 승인 대기자 조회 | - | `UserDto` 리스트 반환 |
| `PATCH` | `/admin/users/{id}/approve` | 가입 승인 | `{ "roleLevel": 1, "position": "팀원" }` | 상태를 `ACTIVE`로 변경 |
| `PATCH` | `/admin/users/{id}/reject` | 가입 거절 | `{ "reason": "정보 불일치" }` | 상태를 `REJECTED`로 변경 |
| `GET` | `/admin/users` | 전체 직원 조회 | - | 다중 부서 정보(`departments`) 포함 |
| `PATCH` | `/admin/users/{id}/role` | 시스템 권한 변경 | `{ "roleLevel": 50 }` | 1:일반, 50:관리자, 100:최고관리자 |
| `DELETE` | `/admin/users/{id}` | 강제 퇴사 | - | 실제 삭제가 아닌 개인정보 익명화 처리 |

### 🏢 조직 관리 (Scopes & Members)
| Method | Endpoint | Description | Payload / Params | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/scopes` | 조직도 트리 조회 | - | 계층 구조(Tree) 데이터 반환 |
| `POST` | `/scopes/{id}/members` | 부서 멤버 추가 | `?userId={id}&position={직급}` | 한 명의 사용자를 여러 부서에 등록 |
| `DELETE` | `/scopes/{id}/members/{uId}` | 부서 소속 해제 | - | 해당 부서와의 연결 관계만 끊음 |
| `PATCH` | `/scopes/{id}/members/{uId}/position` | 직급 수정 | `{ "position": "센터장" }` | 특정 부서 내에서의 직급만 수정 |

### 📂 문서 및 파일 (Documents)
| Method | Endpoint | Description | Payload / Params | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/documents` | 내 열람 가능 목록 | - | 상위 부서(L2) 공유 로직 적용 |
| `POST` | `/documents/upload` | 파일 업로드 | `file` (Multipart), `targetScopeId` (Long) | 지정된 부서 폴더에 저장 |
| `GET` | `/documents/{id}/download`| 파일 다운로드 | - | - |

---

## 📂 데이터 저장 구조 (File System)
- `uploads/Users/{empNo}/`: 사용자 개인 파일 (프로필 등)
- `uploads/Scopes/{scopeCode}/`: 부서별 공유 문서 보관소

## 🔑 초기 접속 정보
- **최고 관리자:** `admin` / `qwer1234!`
- **평생교육원 원장:** `manager` / `qwer1234!` (김기종)

---
*본 명세서는 백엔드 비즈니스 로직과 API를 기준으로 작성되었습니다.*
