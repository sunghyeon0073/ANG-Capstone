# ANG (Admin Next Generation)

> 영진전문대학교 캡스톤 프로젝트 — 조직 문서 관리 및 실시간 협업 플랫폼

ANG는 대학 행정 조직을 위한 **문서 관리 · 실시간 채팅 · 전자결재 · 일정 관리** 통합 플랫폼입니다.
조직 계층 기반의 문서 열람 권한 관리와 AI(Anthropic Claude) 기반 문서 처리가 핵심입니다.

---

## 목차

- [빠른 시작 (Docker)](#빠른-시작-docker)
- [로컬 개발 환경으로 실행](#로컬-개발-환경으로-실행)
- [환경 변수 정리](#환경-변수-정리)
- [자주 발생하는 문제](#자주-발생하는-문제)
- [기술 스택](#기술-스택)
- [시스템 아키텍처](#시스템-아키텍처)
- [주요 기능](#주요-기능)
- [프로젝트 구조](#프로젝트-구조)
- [API 명세](#api-명세)
- [협업 규칙](#협업-규칙)

---

## 빠른 시작 (Docker)

가장 간단한 방법입니다. **Docker만 설치되어 있으면** DB까지 한 번에 올라갑니다.

### 0. 준비물

| 필요한 것 | 비고 |
|-----------|------|
| [Git](https://git-scm.com/) | 클론용 |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Docker Compose 포함 |
| Anthropic API Key | AI 문서 작성/요약 기능용 ([console.anthropic.com](https://console.anthropic.com)) |
| AWS S3 버킷 + 액세스 키 | 파일 업로드 기능용 (없으면 아래 참고) |

### 1. 저장소 클론

> ⚠️ 실제 소스 코드는 **`dev` 브랜치**에 있습니다. 반드시 `-b dev`를 붙여 주세요.

```bash
git clone -b dev https://github.com/sunghyeon0073/ANG-Capstone.git
cd ANG-Capstone
```

### 2. `.env` 파일 만들기

프로젝트 **루트**(`docker-compose.yml`이 있는 위치)에 `.env` 파일을 만들고 아래 내용을 붙여넣습니다.

```env
# ── DB (docker-compose.local.yml 의 MariaDB 컨테이너 사용) ──
DB_URL=jdbc:mariadb://db:3306/ang
DB_USERNAME=ang
DB_PASSWORD=ang_local_password
MARIADB_ROOT_PASSWORD=ang_root_password

# ── 인증 ──
JWT_SECRET=여기에-32자-이상의-아무-랜덤-문자열을-넣으세요-0123456789
ADMIN_INIT_PASSWORD=qwer1234!

# ── AI ──
AI_BASE_URL=http://ai:8888
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-5

# ── AWS S3 (파일 업로드) ──
AWS_ACCESS_KEY_ID=발급받은-키
AWS_SECRET_ACCESS_KEY=발급받은-시크릿
AWS_REGION=ap-northeast-3
S3_BUCKET=본인-버킷-이름
```

> - `JWT_SECRET`은 HS256 서명용이라 **32자(256bit) 이상**이어야 합니다.
> - S3 키가 없다면 `AWS_ACCESS_KEY_ID=dummy` 처럼 아무 값이나 넣어도 서버는 뜹니다. (파일 업로드만 실패)
> - `.env`는 `.gitignore`에 등록되어 있으니 **절대 커밋하지 마세요.**

### 3. 실행

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

- `docker-compose.yml` → Backend / Frontend / AI 컨테이너
- `docker-compose.local.yml` → 로컬용 MariaDB 컨테이너 추가

첫 빌드는 Gradle·npm·LibreOffice 설치 때문에 **5~10분** 정도 걸립니다.

### 4. 접속

| 서비스 | 주소 |
|--------|------|
| 웹 화면 | http://localhost:5500 |
| Backend API | http://localhost:9090/api |
| 헬스 체크 | http://localhost:9090/api/health |
| AI 서버 | http://localhost:8888/health |

첫 실행 시 테이블과 테스트 계정이 자동으로 생성됩니다.

| 계정 | ID | 비밀번호 |
|------|----|----------|
| 최고관리자 | `admin` | `qwer1234!` |
| 평생교육원 원장 (김기종) | `manager` | `qwer1234!` |

> 운영 환경에서는 반드시 비밀번호를 변경하세요.

### 5. 종료 / 로그 확인

```bash
# 로그 보기 (Ctrl+C로 빠져나옴)
docker compose logs -f backend

# 종료
docker compose -f docker-compose.yml -f docker-compose.local.yml down

# DB 데이터까지 완전히 초기화
docker compose -f docker-compose.yml -f docker-compose.local.yml down -v
```

---

## 로컬 개발 환경으로 실행

코드를 수정하면서 개발할 때는 각 서버를 직접 실행하는 편이 빠릅니다.

### 0. 준비물

| 도구 | 버전 |
|------|------|
| JDK | 21 |
| Node.js | 22 이상 |
| Python | 3.12 |
| MariaDB | 11.x (또는 아래처럼 Docker로 DB만 실행) |

### 1. DB 준비

MariaDB를 따로 설치하지 않았다면 DB만 Docker로 띄울 수 있습니다.

```bash
docker run -d --name ang-db -p 3306:3306 \
  -e MARIADB_DATABASE=ang \
  -e MARIADB_USER=ang \
  -e MARIADB_PASSWORD=ang_local_password \
  -e MARIADB_ROOT_PASSWORD=ang_root_password \
  mariadb:11.4
```

테이블은 백엔드 첫 실행 시 JPA(`ddl-auto: update`)가 자동 생성합니다.

### 2. Backend (Spring Boot · 포트 9090)

백엔드는 환경 변수로 설정값을 읽습니다. 터미널에서 환경 변수를 지정한 뒤 실행하세요.

**macOS / Linux**

```bash
cd Backend
export DB_URL="jdbc:mariadb://localhost:3306/ang"
export DB_USERNAME=ang
export DB_PASSWORD=ang_local_password
export JWT_SECRET="여기에-32자-이상의-아무-랜덤-문자열을-넣으세요-0123456789"
export ADMIN_INIT_PASSWORD="qwer1234!"
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
export AWS_ACCESS_KEY_ID=dummy
export AWS_SECRET_ACCESS_KEY=dummy
./gradlew bootRun
```

**Windows (PowerShell)**

```powershell
cd Backend
$env:DB_URL="jdbc:mariadb://localhost:3306/ang"
$env:DB_USERNAME="ang"
$env:DB_PASSWORD="ang_local_password"
$env:JWT_SECRET="여기에-32자-이상의-아무-랜덤-문자열을-넣으세요-0123456789"
$env:ADMIN_INIT_PASSWORD="qwer1234!"
$env:ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
$env:AWS_ACCESS_KEY_ID="dummy"
$env:AWS_SECRET_ACCESS_KEY="dummy"
.\gradlew.bat bootRun
```

> IntelliJ를 쓴다면 Run Configuration → **Environment variables**에 같은 값을 넣어도 됩니다.
> 또는 `src/main/resources/application-local.yml.example`을 복사해 `application-local.yml`로 만들고 `${...}` 부분을 실제 값으로 채워도 됩니다. (이 파일은 Git에 올라가지 않습니다)

`Started ...Application` 로그가 보이면 http://localhost:9090/api/health 로 확인합니다.

### 3. AI 서버 (FastAPI · 포트 8888)

```bash
cd AI
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
# .env 파일에 ANTHROPIC_API_KEY 입력
uvicorn main:app --reload --port 8888 --env-file .env
```

http://localhost:8888/health 로 확인합니다.

### 4. Frontend (React + Vite · 포트 5500)

```bash
cd Frontend
npm install
npm run dev
```

브라우저가 자동으로 http://localhost:5500 을 엽니다.
`/api` 요청(WebSocket 포함)은 Vite 프록시가 `http://127.0.0.1:9090` 으로 넘겨주므로 따로 설정할 필요가 없습니다.

### 5. (선택) HWP 편집 브릿지 — Windows 전용

한글(.hwp) 문서 치환·PDF 미리보기 기능은 **한컴오피스 한글이 설치된 Windows**에서만 동작합니다.

```powershell
cd HwpBridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8877
```

백엔드에 `HWP_EDIT_BASE_URL=http://<윈도우-PC-IP>:8877` 환경 변수를 추가합니다.
Docker와 함께 한 번에 올리려면 루트에서 `.\scripts\dev-up-with-hwp.ps1`을 실행하세요. 자세한 내용은 [HwpBridge/README.md](HwpBridge/README.md)를 참고하세요.

---

## 환경 변수 정리

| 변수 | 필수 | 사용처 | 설명 |
|------|:----:|--------|------|
| `DB_URL` | ✅ | Backend | `jdbc:mariadb://<host>:3306/<db>` |
| `DB_USERNAME` / `DB_PASSWORD` | ✅ | Backend | DB 계정 |
| `JWT_SECRET` | ✅ | Backend | 32자 이상 랜덤 문자열 |
| `ADMIN_INIT_PASSWORD` | ✅ | Backend | 초기 관리자 비밀번호 |
| `ANTHROPIC_API_KEY` | ✅ | Backend, AI | Claude API 키 |
| `ANTHROPIC_MODEL` | | Backend, AI | 기본값: Backend `claude-haiku-4-5-20251001`, AI `claude-sonnet-5` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | ✅ | Backend | S3 접근 키 (없으면 `dummy`) |
| `AWS_REGION` | | Backend | 기본값 `ap-northeast-3` |
| `S3_BUCKET` | | Backend | 파일 저장 버킷 이름 |
| `AI_BASE_URL` | | Backend | 기본값 `http://localhost:8888` (Docker에서는 `http://ai:8888`) |
| `HWP_EDIT_BASE_URL` | | Backend | HWP 브릿지 주소 |
| `CORS_ALLOWED_ORIGIN_PATTERNS` | | Backend | 허용할 프론트 주소 (localhost 5173/5500 등 기본 포함) |
| `VITE_API_URL` | | Frontend | 기본값 `/api` |

---

## 자주 발생하는 문제

| 증상 | 해결 |
|------|------|
| 클론했는데 `README.md`만 있음 | `main`이 아니라 `dev` 브랜치를 받아야 합니다 → `git checkout dev` |
| `DB_URL is required` 에러 | 루트에 `.env` 파일이 없거나 값이 비어 있음 |
| 백엔드가 `Communications link failure`로 종료 | DB가 아직 안 떴거나 주소/포트가 다름. `docker ps`로 DB 컨테이너 확인 |
| `Port 5500 is already in use` | 다른 프로세스가 포트 사용 중. Live Server 등을 종료 (Vite는 `strictPort: true`) |
| `./gradlew: Permission denied` | `chmod +x gradlew` |
| AI 기능 호출 시 500 에러 | `ANTHROPIC_API_KEY` 확인, AI 서버(8888) 실행 여부 확인 |
| 파일 업로드 실패 | AWS 키/버킷이 실제 값인지 확인 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Backend** | Spring Boot 3.4.0, Java 21, Spring Security 6, Spring WebSocket (STOMP), Spring Data JPA |
| **Frontend** | React 19, Vite, React Router DOM 7, Axios |
| **Database** | MariaDB (운영: AWS RDS) |
| **File Storage** | AWS S3 |
| **AI** | Python 3.12, FastAPI, Anthropic Claude API |
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
                       │  ├─ mail / schedule / approval   │
                       │  └─ S3FileService                │
                       └────────┬─────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
            MariaDB           AWS S3         AI Service
                           (파일 저장)     (FastAPI :8888)
                                                 │
                                        Anthropic Claude API
```

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **문서 관리** | 파일 업로드·다운로드·미리보기 (PDF, 이미지, Word, Excel, HWP), AI 문서 작성·요약 |
| **실시간 채팅** | 1:1 / 그룹 채팅방, STOMP WebSocket 기반 실시간 메시지 |
| **전자결재** | 결재 요청·승인·반려·완료 워크플로우 |
| **일정 관리** | 개인·부서·AI 일정 캘린더 뷰 |
| **파일 저장소** | S3 기반 파일 관리, 휴지통, 유형별 정렬 |
| **게시판 / 메일** | 공지·자유 게시판, 내부 메일 |
| **조직 관리** | 계층형 조직도(최대 3단계), 다중 부서 소속, 직급 관리 |
| **관리자** | 가입 승인·거절, 권한 변경, 강제 퇴사(익명화) |

### 핵심 비즈니스 로직

- **조직 계층**: `COMPANY(L1) → DEPARTMENT(L2) → TEAM(L3)`. 같은 **L2 부서** 산하 사용자끼리 문서를 열람할 수 있습니다.
- **가입 흐름**: 회원가입(scopeCode 입력) → `PENDING` → 관리자 승인 시 `ACTIVE` / 거절 시 `REJECTED`
- **JWT 자동 갱신**: Access Token 만료(401) 시 Axios 인터셉터가 `/auth/refresh`로 재발급 후 원래 요청을 재시도합니다.

---

## 프로젝트 구조

```
ANG-Capstone/
├── Backend/                 # Spring Boot (:9090, context-path /api)
│   └── src/main/java/com/ang/Backend/
│       ├── common/          # 공통 응답·예외·enum
│       ├── config/          # Security, WebSocket, S3, DataInitializer(초기 데이터)
│       ├── domain/          # ⭐ 기능별 패키지 (auth, user, admin, scope, document,
│       │                    #    file, chat, mail, schedule, approval, role ...)
│       └── security/        # JWT 필터
├── Frontend/                # React + Vite (:5500)
│   └── src/
│       ├── api/             # axios 인스턴스 + 기능별 API
│       ├── components/      # 페이지·레이아웃 컴포넌트
│       └── style/           # 페이지별 CSS
├── AI/                      # FastAPI AI 서버 (:8888)
├── HwpBridge/               # (선택) 한컴 한글 COM 자동화 브릿지 (:8877, Windows)
├── docs/                    # 기능 정의서, ERD, API 명세서
├── scripts/                 # 개발용 스크립트
├── docker-compose.yml       # Backend + Frontend + AI
├── docker-compose.local.yml # 로컬 MariaDB 추가
└── .github/workflows/       # CI(빌드 검증) / CD(EC2 배포)
```

더 자세한 설계 문서는 [`docs/`](https://github.com/sunghyeon0073/ANG-Capstone/tree/dev/docs) 폴더를 참고하세요.

---

## API 명세

모든 엔드포인트는 `/api` prefix를 사용하며, 인증이 필요한 요청은 `Authorization: Bearer <accessToken>` 헤더가 필요합니다.
전체 명세는 [`docs/API_기능_명세서.md`](https://github.com/sunghyeon0073/ANG-Capstone/blob/dev/docs/API_기능_명세서.md)에 있습니다.

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/health` | 서버 상태 확인 |
| `POST` | `/auth/login` | 로그인 (JWT 발급) — `{ empNo, password }` |
| `POST` | `/auth/register` | 회원가입 |
| `POST` | `/auth/refresh` | 토큰 재발급 |
| `GET` | `/admin/users/pending` | 승인 대기자 조회 |
| `PATCH` | `/admin/users/{id}/approve` | 가입 승인 |
| `GET` | `/scopes` | 조직도 트리 조회 |
| `GET` | `/documents` | 열람 가능 문서 목록 |
| `POST` | `/documents/upload` | 파일 업로드 (Multipart) |
| `GET` | `/chat/rooms` | 내 채팅방 목록 |
| `WS` | `/ws` (STOMP) | 실시간 메시지 송수신 |

---

## 협업 규칙

### 브랜치 전략

```
main          ← 최종 완성본
  └── dev     ← 팀원 작업물이 합쳐지는 곳 (CD: push 시 EC2 자동 배포)
        └── feature/기능명   ← 각자 기능 개발
```

| 접두어 | 용도 | 예시 |
|--------|------|------|
| `feature/` | 새 기능 | `feature/user-login` |
| `fix/` | 버그 수정 | `fix/login-error` |
| `design/` | UI 작업 | `design/main-page` |

### 작업 순서

```bash
git checkout dev && git pull           # 최신 코드 받기
git checkout -b feature/기능명          # 내 브랜치 만들기
git add . && git commit -m "feat: 기능 설명"
git push origin feature/기능명          # GitHub에 올린 뒤 dev로 PR
```

### 금지 사항

- `main`, `dev`에 직접 push / 직접 작업 ❌
- `git push --force` ❌
- 본인 PR을 리뷰 없이 본인이 merge ❌
- `.env`, `application-local.yml` 등 비밀 정보가 담긴 파일 커밋 ❌

### CI/CD

- **CI (`ci.yml`)**: `main`, `dev`, `dev-server`, `test-server` 브랜치 push/PR 시 Backend·Frontend·AI 빌드 검증
- **CD (`cd.yml`)**: `dev`, `dev-server` 브랜치 push 시 EC2에서 `docker compose up -d --build` 자동 배포
