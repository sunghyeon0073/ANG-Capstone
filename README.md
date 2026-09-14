# ANG (Admin Next Generation)

> 영진전문대학교 캡스톤 프로젝트 — 조직 문서 관리 및 실시간 협업 플랫폼

---

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [기술 스택](#기술-스택)
- [시스템 아키텍처](#시스템-아키텍처)
- [주요 기능](#주요-기능)
- [핵심 비즈니스 로직](#핵심-비즈니스-로직)
- [프로젝트 구조](#프로젝트-구조)
- [시작하기](#시작하기)
- [환경 변수](#환경-변수)
- [API 명세](#api-명세)
- [초기 접속 정보](#초기-접속-정보)

---

## 프로젝트 개요

ANG는 대학 행정 조직을 위한 **문서 관리·실시간 채팅·전자결재·일정 관리** 통합 플랫폼입니다.  
조직 계층 기반의 문서 열람 권한 관리와 AI 기반 문서 처리를 핵심으로 합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Backend** | Spring Boot 3.4.0, Java 21, Spring Security 6, Spring WebSocket (STOMP), Spring Data JPA |
| **Frontend** | React 19, Vite, React Router DOM 7, Axios |
| **Database** | MariaDB (AWS RDS, ap-northeast-3) |
| **File Storage** | AWS S3 (ap-northeast-3) |
| **AI** | Python 3.12, Anthropic Claude API |
| **Auth** | JWT (JJWT 0.12.6) — Access 30분 / Refresh 7일 |
| **Infra** | Docker Compose, GitHub Actions CI/CD, AWS EC2 |

---

## 시스템 아키텍처

```
사용자 브라우저
      │
      ▼
┌─────────────┐        ┌──────────────────────────────────┐
│  Frontend   │──────▶ │  Backend (Spring Boot :9090)     │
│  (Nginx     │  REST  │  /api context path               │
│   :5500)    │  WS    │  ├─ auth / user / admin          │
└─────────────┘        │  ├─ scope / document / file      │
                       │  ├─ chat (STOMP WebSocket)       │
                       │  ├─ mail / schedule              │
                       │  └─ S3FileService                │
                       └────────┬─────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
        MariaDB RDS          AWS S3          AI Service
        (ang_db)          (파일 저장)      (Python :8888)
                                                 │
                                        Anthropic Claude API
                                          (LLM 문서 처리)
```

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **문서 관리** | 파일 업로드·다운로드·미리보기 (PDF, 이미지, Word, Excel), AI 문서 요약·향상 |
| **실시간 채팅** | 1:1 / 그룹 채팅방, STOMP WebSocket 기반 실시간 메시지 |
| **전자결재** | 결재 요청·승인·반려·완료 워크플로우 |
| **일정 관리** | 개인·부서·AI 일정 캘린더 뷰, 이벤트 CRUD |
| **파일 저장소** | AWS S3 기반 파일 관리, 휴지통, 파일 유형별 정렬 |
| **게시판** | 공지·자유 게시판 |
| **메일** | 내부 메일 발신·수신·임시저장·중요 표시 |
| **조직 관리** | 계층형 조직도, 다중 부서 소속, 직급 관리 |
| **관리자** | 가입 승인·거절, 권한 변경, 강제 퇴사(익명화) |

---

## 핵심 비즈니스 로직

### 조직 계층 구조

시스템은 최대 3단계 계층을 사용합니다.

```
Level 1 (COMPANY)    예: 영진전문대학교
  └─ Level 2 (DEPARTMENT)    예: 평생교육원  ← 핵심 권한 단위
       ├─ Level 3 (TEAM)     예: 장기요양교육센터
       └─ Level 3 (TEAM)     예: 행정지원팀
```

### 문서 열람 권한

- 동일한 **Level 2 조상 부서**를 공유하는 사용자끼리 문서 열람 가능
- 예: '장기요양교육센터(L3)' 직원은 '행정지원(L3)' 직원의 문서를 볼 수 있음 (둘 다 '평생교육원(L2)' 산하)
- 파일은 `uploads/Scopes/{scopeCode}/` 경로에 물리 저장

### 사용자 가입 워크플로우

```
회원가입 (scopeCode 입력)
      ↓
  PENDING 상태 (로그인 불가)
      ↓
관리자 검토
  ├─ 승인: roleLevel + position 지정 → ACTIVE
  └─ 거절: 사유 입력 → REJECTED
```

### 다중 부서 소속

- 한 사용자가 여러 부서에 동시 소속 가능 (`UserMembership` 기반)
- 부서마다 서로 다른 직급(position) 보유 가능

### JWT 자동 갱신

1. 프론트엔드는 `AccessToken`을 Authorization 헤더에 담아 요청
2. 만료(30분) 시 백엔드가 401 반환
3. Axios 응답 인터셉터가 401 감지 → `/auth/refresh` 호출
4. 새 토큰으로 원래 요청 자동 재시도 (사용자 인지 불가)
5. RefreshToken(7일)마저 만료 시 → 로그아웃 처리

---

## 프로젝트 구조

```
ANG/
├── Backend/                          # Spring Boot
│   └── src/main/java/com/ang/Backend/
│       ├── common/
│       │   ├── Controller/           # HealthController
│       │   ├── enums/                # ChatMessageType, ChatRoomType
│       │   └── exception/            # ErrorCode, CustomException
│       ├── config/
│       │   ├── SecurityConfig.java
│       │   ├── WebSocketConfig.java  # STOMP /ws 엔드포인트
│       │   ├── S3Config.java
│       │   └── DataInitializer.java  # 초기 데이터 시딩
│       ├── domain/
│       │   ├── auth/                 # 로그인·회원가입·토큰 갱신
│       │   ├── user/                 # 사용자 프로필·검색
│       │   ├── admin/                # 관리자 승인·권한
│       │   ├── scope/                # 조직도·부서 멤버
│       │   ├── document/             # 문서 업로드·AI 처리
│       │   ├── file/                 # S3 파일 관리
│       │   ├── chat/                 # 실시간 채팅
│       │   ├── mail/                 # 내부 메일
│       │   ├── schedule/             # 일정 관리
│       │   └── role/                 # 권한(Role/Permission)
│       └── security/
│           └── JwtAuthenticationFilter.java
│
├── Frontend/                         # React + Vite
│   └── src/
│       ├── api/
│       │   ├── axios.js              # 인터셉터, 토큰 갱신
│       │   ├── authApi.js
│       │   ├── documentApi.js
│       │   ├── scheduleApi.js
│       │   ├── adminApi.js
│       │   ├── scopeApi.js
│       │   ├── userApi.js
│       │   └── mailApi.js
│       ├── components/
│       │   ├── pages/
│       │   │   ├── Home.jsx          # 대시보드 홈
│       │   │   ├── DocumentWriter.jsx # 문서 관리·AI 처리
│       │   │   ├── ESignature.jsx    # 전자결재
│       │   │   ├── Calendar.jsx      # 일정 관리
│       │   │   ├── FileStorage.jsx   # 파일 저장소
│       │   │   ├── Board.jsx         # 게시판
│       │   │   ├── Mail.jsx          # 메일
│       │   │   ├── Chat.jsx          # 실시간 채팅
│       │   │   ├── Organization.jsx  # 조직도
│       │   │   ├── MyPage.jsx        # 마이페이지
│       │   │   └── Admin.jsx         # 관리자 패널
│       │   ├── Dashboard.jsx         # 메인 레이아웃
│       │   ├── TopNavBar.jsx
│       │   ├── Sidebar.jsx
│       │   └── FloatingMascot.jsx    # AI 어시스턴트
│       └── utils/
│           └── documentFileUtils.js  # 파일 타입·미리보기
│
├── AI/                               # Python AI 서비스 (:8888)
│   └── (Anthropic Claude API 기반 LLM 문서 처리)
│
├── docker-compose.yml
├── .env                              # 환경 변수 (git 제외)
└── .github/
    └── workflows/
        ├── ci.yml                    # PR/push 빌드 검증
        └── cd.yml                    # EC2 자동 배포
```

---

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- `.env` 파일 (아래 [환경 변수](#환경-변수) 참고)

### Docker로 실행 (권장)

```bash
docker compose up -d --build
```

| 서비스 | 주소 |
|--------|------|
| Frontend | http://localhost:5500 |
| Backend API | http://localhost:9090/api |
| AI Service | http://localhost:8888 |

### 로컬 개발 환경

**Backend**
```bash
cd Backend
./gradlew bootRun
# 실행 주소: http://localhost:9090/api
```

**Frontend**
```bash
cd Frontend
npm install
npm run dev
# 실행 주소: http://localhost:5173
# /api 요청은 자동으로 http://localhost:9090 으로 프록시
```

---

## 환경 변수

`.env` 파일을 프로젝트 루트에 생성하세요.

```env
# Database (AWS RDS MariaDB)
DB_URL=jdbc:mariadb://<host>:3306/ang_db
DB_USERNAME=
DB_PASSWORD=

# JWT
JWT_SECRET=

# Admin
ADMIN_INIT_PASSWORD=

# CORS
CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:5500,http://localhost:5173

# AI
AI_BASE_URL=http://ai:8888
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Frontend
VITE_API_URL=/api
```

---

## API 명세

모든 엔드포인트는 `/api` prefix를 사용합니다.  
인증이 필요한 요청은 `Authorization: Bearer <accessToken>` 헤더를 포함해야 합니다.

### 인증 (Auth)

| Method | Endpoint | 설명 | Body |
|--------|----------|------|------|
| `POST` | `/auth/login` | 로그인 (JWT 발급) | `{ empNo, password }` |
| `POST` | `/auth/register` | 회원가입 | `{ name, empNo, birthdate, email, password, passwordConfirm, scopeCode }` |
| `POST` | `/auth/refresh` | 토큰 재발급 | `{ refreshToken }` |

### 관리자 (Admin)

| Method | Endpoint | 설명 | Body / Params |
|--------|----------|------|---------------|
| `GET` | `/admin/users/pending` | 승인 대기자 조회 | — |
| `PATCH` | `/admin/users/{id}/approve` | 가입 승인 | `{ roleLevel, position }` |
| `PATCH` | `/admin/users/{id}/reject` | 가입 거절 | `{ reason }` |
| `GET` | `/admin/users` | 전체 직원 조회 | — |
| `PATCH` | `/admin/users/{id}/role` | 권한 변경 | `{ roleLevel }` ※ 1·50·100 |
| `DELETE` | `/admin/users/{id}` | 강제 퇴사 (익명화) | — |

### 조직 (Scopes)

| Method | Endpoint | 설명 | Body / Params |
|--------|----------|------|---------------|
| `GET` | `/scopes` | 조직도 트리 조회 | — |
| `POST` | `/scopes/{id}/members` | 멤버 추가 | `?userId=&position=` |
| `DELETE` | `/scopes/{id}/members/{uId}` | 멤버 소속 해제 | — |
| `PATCH` | `/scopes/{id}/members/{uId}/position` | 직급 수정 | `{ position }` |

### 문서 (Documents)

| Method | Endpoint | 설명 | Body / Params |
|--------|----------|------|---------------|
| `GET` | `/documents` | 열람 가능 문서 목록 | — |
| `POST` | `/documents/upload` | 파일 업로드 | `file` (Multipart), `targetScopeId` |
| `GET` | `/documents/{id}/download` | 파일 다운로드 | — |

### 채팅 (Chat)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/chat/rooms/private` | 1:1 채팅방 생성 |
| `POST` | `/chat/rooms/group` | 그룹 채팅방 생성 |
| `GET` | `/chat/rooms` | 내 채팅방 목록 |
| `WS` | `/ws` (STOMP) | 실시간 메시지 송수신 |

---

## 초기 접속 정보

| 계정 | ID | 비밀번호 |
|------|----|----------|
| 최고관리자 | `admin` | `qwer1234!` |
| 평생교육원 원장 (김기종) | `manager` | `qwer1234!` |

> **주의:** 운영 환경에서는 반드시 비밀번호를 변경하세요.

---

## CI/CD

- **CI (`ci.yml`)**: `main`, `dev`, `dev-server`, `test-server` 브랜치에 push/PR 시 Backend·Frontend·AI 빌드 검증
- **CD (`cd.yml`)**: `dev-server`, `dev` 브랜치에 push 시 EC2 SSH 접속 → `docker compose up -d --build` 자동 배포
