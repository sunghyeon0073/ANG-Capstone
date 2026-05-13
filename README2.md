# Ang Project

> Spring Boot + Vite + FastAPI + Ollama 기반 풀스택 프로젝트

---

## 기술 스택

### Runtime
| | 버전 |
|--|------|
| Node.js | 22+ |
| Java | 21 |
| Python | 3.12+ |

### Frontend
| 라이브러리 | 버전 |
|-----------|------|
| React | 19.2.5 |
| React Router DOM | 7.15.0 |
| Axios | 1.16.0 |
| React Icons | 5.6.0 |
| Vite | 8.0.10 |
| ESLint | 10.2.1 |

### Backend
| 라이브러리 | 버전 |
|-----------|------|
| Spring Boot | 3.4.0 |
| JJWT | 0.12.6 |
| Lombok | Spring Boot 관리 |
| MariaDB Java Client | Spring Boot 관리 |

### AI
| 라이브러리 | 버전 |
|-----------|------|
| FastAPI | 0.115.12 |
| Uvicorn | 0.34.3 |
| Ollama | 0.4.8 |
| Pydantic | 2.11.4 |
| python-dotenv | 1.1.0 |

### DB
| | 버전 |
|--|------|
| MariaDB | 12.x |

---

## 프로젝트 구조

```
Ang/
├── Backend/    ← 자바 서버 (포트 9090)
├── Frontend/   ← 웹 화면 (포트 5500)
├── AI/         ← AI 서버 (포트 8888)
└── README.md
```

---

## 로컬 환경 설정

### 1. MariaDB 설치 및 설정

#### Windows 서비스로 설치 (권장)

```powershell
winget install MariaDB.Server
```

설치 후 서비스 등록 및 시작:

```powershell
& "C:\Program Files\MariaDB 12.2\bin\mysqld.exe" --install MariaDB
Start-Service -Name "MariaDB"
```

DB 생성:

```powershell
& "C:\Program Files\MariaDB 12.2\bin\mysql.exe" -u root -p -e "CREATE DATABASE IF NOT EXISTS ang_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

#### MariaDB 서비스 상태 확인

```powershell
Get-Service -Name "MariaDB"
```

`Status`가 `Running`이면 완료.

---

### 2. 백엔드 환경변수 설정

`Backend/src/main/resources/application-local.yml` 파일을 생성하고 아래 내용을 채워주세요.  
이 파일은 `.gitignore`에 등록되어 있어 GitHub에 올라가지 않습니다.

```yaml
DB_URL: jdbc:mariadb://localhost:3306/ang_db?useSSL=false&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true
DB_USERNAME: root
DB_PASSWORD: 비밀번호
JWT_SECRET: 256비트-이상의-시크릿-키
ADMIN_INIT_PASSWORD: 초기관리자비밀번호
FILE_UPLOAD_DIR: uploads
OLLAMA_BASE_URL: http://localhost:11434
OLLAMA_MODEL: llama3.2
```

### 3. AI 환경변수 설정

`AI/.env.example` 파일을 복사해서 `.env`로 이름 변경 후 값을 채워주세요.

```
OLLAMA_MODEL=llama3.2
OLLAMA_HOST=http://localhost:11434
```

---

## 서버 실행 방법

> CMD/PowerShell 창을 **3개** 열어서 각각 실행하세요.

### 1. 백엔드

```powershell
cd Backend
.\gradlew.bat bootRun
```

`Started SpringBootDeveloperApplication` 로그가 뜨면 완료

### 2. 프론트엔드

```powershell
cd Frontend
npm install
npm run dev
```

`http://localhost:5500` 접속

### 3. AI 서버

```powershell
cd AI
pip install -r requirements.txt
uvicorn main:app --reload --port 8888
```

> Ollama가 먼저 실행되어 있어야 합니다 (`ollama serve`)

---

## 서비스 흐름

```
사용자 브라우저
  ↓
Frontend (5500)
  ↓ API 요청
Backend (9090/api)
  ↓ AI 기능 필요할 때
AI 서버 (8888)
  ↓
Ollama (AI 모델)
```

---

## 백엔드 패키지 구조

```
Backend/src/main/java/com/ang/Backend/
├── common/             ← 공통으로 쓰는 것들
│   ├── Controller/     ← 헬스체크 API
│   ├── exception/      ← 에러 처리
│   └── response/       ← 응답 형식 통일
├── config/             ← 설정 파일들
│   ├── SecurityConfig  ← 보안 설정
│   ├── OllamaConfig    ← AI 연결 설정
│   └── DataInitializer ← 초기 데이터 설정
├── security/           ← JWT 로그인/토큰
└── domain/             ← ⭐ 기능 개발은 여기에
    └── user/
        ├── Controller/ ← ① 요청 받는 곳 (API 입구)
        ├── DTO/        ← ② 데이터 형식 정의
        ├── service/    ← ③ 실제 기능 로직
        ├── DAO/        ← ④ DB 조회
        └── entity/     ← ⑤ DB 테이블 구조
```

### 새 기능 추가 순서

예) 게시판 기능을 만든다면

1. `domain/board/` 폴더 생성
2. `entity/` → DB 테이블 설계
3. `DAO/` → DB 조회 작성
4. `service/` → 기능 로직 작성
5. `Controller/` → API 엔드포인트 연결
6. `DTO/` → 데이터 형식 정의

---

## 프론트엔드 구조

```
Frontend/src/
├── api/
│   ├── axios.js        ← Axios 인스턴스 (baseURL, 인터셉터)
│   └── authApi.js      ← 로그인/회원가입 API 함수
├── components/
│   ├── Dashboard.jsx   ← 대시보드 레이아웃
│   ├── Login.jsx       ← 로그인 페이지
│   ├── SignUp.jsx      ← 회원가입 페이지
│   ├── Sidebar.jsx     ← 사이드바
│   ├── TopNavBar.jsx   ← 상단 네비게이션
│   └── pages/          ← 대시보드 내부 페이지
│       ├── Home.jsx
│       ├── Chat.jsx
│       ├── Memo.jsx
│       ├── Board.jsx
│       ├── Calendar.jsx
│       ├── Mail.jsx
│       ├── DocumentWriter.jsx
│       ├── ESignature.jsx
│       ├── FileStorage.jsx
│       ├── MyPage.jsx
│       └── Organization.jsx
├── router/
│   └── router.jsx      ← 페이지 경로(URL) 설정
├── store/
│   └── store.js        ← 전역 상태 (Zustand)
├── hooks/              ← 커스텀 훅
├── utils/              ← 공통 유틸 함수
├── App.jsx
├── main.jsx
└── index.css
```

---

## ✅ 현재 구현 완료된 핵심 로직 (Backend)

현재 백엔드 서버(포트 9090)에는 다음과 같은 핵심 코어 기능들이 완벽하게 구현 및 검증되어 있습니다.

1.  **인증 및 계정 (Auth & User)**
    *   **JWT 기반 인증:** 로그인 시 AccessToken 및 RefreshToken 발급
    *   **회원가입:** 팀 단위의 `고유 식별 코드(scopeCode)`가 있어야만 가입 가능한 보안 구조 (가입 시 '승인 대기' 상태)
    *   **권한 분리:** 일반 사용자, 관리자, 최고관리자로 나뉘는 Role-based Access Control (RBAC)
2.  **조직 및 부서 관리 (Scope)**
    *   **계층형 조직도:** 회사(COMPANY) - 부서(DEPARTMENT) - 팀(TEAM) 구조 지원
    *   **부서 생성:** 관리자가 상위 부서를 지정하여 조직을 생성하고, 팀 전용 가입 코드를 직접 부여
3.  **관리자 기능 (Admin)**
    *   **가입 승인:** 승인 대기 중인 인원을 조회하고 직급을 부여하여 서비스 이용 권한 부여
4.  **문서 및 파일 관리 (Document & File)**
    *   **물리 파일 업로드:** 로컬 디스크(`uploads/`)에 파일을 안전하게 저장하고 DB에 메타데이터 기록
    *   **문서함 관리:** 내 문서(개인 소유) 및 부서 문서(부서 내 공유) 분리 조회
    *   **문서/파일 완전 삭제:** DB 기록 삭제 시 하드디스크의 실제 파일도 동시 삭제 처리

---

## 📡 API 연동 명세서 (Frontend 용)

> **Base URL:** `http://localhost:9090/api`
> **공통 헤더:** 인증이 필요한 API는 `Authorization: Bearer {accessToken}` 필수 포함

### 1. 🔐 인증 및 계정 (Auth)

| 메서드 | 경로 | 인증 | 설명 | 파라미터 / Body |
|--------|------|------|------|----------------|
| **POST** | `/auth/register` | ❌ | 회원가입 | `{"name", "empNo", "birthdate", "email", "password", "passwordConfirm", "scopeCode"}` |
| **POST** | `/auth/login` | ❌ | 로그인 | `{"empNo", "password"}` -> `accessToken`, `user` 반환 |
| **GET** | `/users/me` | ⭕ | 내 정보 조회 | (현재 토큰 기반으로 내 정보 반환) |

### 2. 🏢 부서 및 조직도 (Scope)

| 메서드 | 경로 | 인증 | 설명 | 파라미터 / Body |
|--------|------|------|------|----------------|
| **GET** | `/scopes` | ⭕ | 조직도 전체 조회 | 계층형 부서 트리 반환 |
| **POST** | `/scopes` | ⭕ | 조직/팀 생성 | `{"name", "type"(COMPANY/DEPARTMENT/TEAM), "scopeCode", "parentId"}` |
| **GET** | `/scopes/{id}/members` | ⭕ | 부서별 인원 조회 | 특정 부서에 속한 멤버 리스트 반환 |

### 3. 👑 관리자 전용 (Admin)

| 메서드 | 경로 | 인증 | 설명 | 파라미터 / Body |
|--------|------|------|------|----------------|
| **GET** | `/admin/users/pending` | ⭕ | 가입 승인 대기자 조회 | |
| **PATCH** | `/admin/users/{userId}/approve` | ⭕ | 가입 승인 및 직급 부여 | `{"position": "사원"}` |

### 4. 📄 문서 및 파일 (Document)

| 메서드 | 경로 | 인증 | 설명 | 파라미터 / Body |
|--------|------|------|------|----------------|
| **POST** | `/documents` | ⭕ | 파일 업로드 & 문서 생성 | **FormData** : `title`(Text), `file`(File), `targetScopeId`(선택) |
| **GET** | `/documents/my` | ⭕ | 내 문서 리스트 조회 | |
| **GET** | `/documents/department` | ⭕ | 부서 문서 리스트 조회 | `?keyword=검색어` (Query Param) |
| **GET** | `/documents/{docId}` | ⭕ | 문서 단건 상세 조회 | |
| **DELETE** | `/documents/{docId}` | ⭕ | 문서 및 물리 파일 삭제 | |

---

## 팀 개발 흐름

### 브랜치 전략

```
main        ← 최종 완성본만 올라오는 곳
  └── dev       ← 팀원 작업물이 합쳐지는 곳
        └── feature/기능명   ← 각자 기능 개발하는 곳
```

### 작업 순서

```
① dev 브랜치에서 내 브랜치 만들기
② 내 브랜치에서 기능 개발
③ GitHub에 push 후 PR(Pull Request) 올리기
④ 팀원 코드 확인 후 dev에 merge
⑤ git pull로 최신 코드 내려받기
⑥ 기능 다 모이면 통합 테스트
⑦ 문제 없으면 main에 merge
```

### 브랜치 이름 규칙

```
feature/기능명      ← 새 기능 개발   예) feature/user-login
fix/버그내용        ← 버그 수정      예) fix/login-error
design/페이지명     ← UI 작업        예) design/main-page
```

### 자주 쓰는 명령어

```powershell
# dev 브랜치로 이동
git checkout dev

# 최신 내용 받아오기
git pull origin dev

# 내 브랜치 만들기
git checkout -b feature/기능명

# 작업 저장
git add .
git commit -m "feat: 기능 설명"

# GitHub에 올리기
git push origin feature/기능명
```

---

## ⛔ 금칙사항

### Git 관련

| 금지 | 이유 |
|------|------|
| `main`에 직접 push | 전체 코드가 망가질 수 있음 |
| `git push --force` | 다른 팀원 작업이 사라질 수 있음 |
| PR 없이 dev에 직접 merge | 코드 리뷰 없이 합쳐지면 버그 추적 불가 |
| 팀원 리뷰 없이 본인이 본인 PR merge | 혼자 검토하면 실수를 못 잡음 |

### 코드 관련

| 금지 | 이유 |
|------|------|
| `application-local.yml` 커밋 | DB 비밀번호, JWT 시크릿 등 민감 정보 노출 |
| `.env` 커밋 | AI 서버 환경변수 노출 |
| 다른 팀원 브랜치에 직접 push | 작업 충돌 발생 |
| `dev`, `main` 브랜치에서 직접 작업 | 항상 feature 브랜치 만들어서 작업 |
