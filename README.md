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

### 페이지 추가 방법

**1. 페이지 파일 생성** `src/components/pages/Board.jsx`

```jsx
function Board() {
  return <div>게시판 페이지</div>
}

export default Board
```

**2. 라우터에 경로 등록** `src/router/router.jsx`

```jsx
import Board from '../components/pages/Board'

const router = createBrowserRouter([
  { path: '/',          element: <Login /> },
  { path: '/login',     element: <Login /> },
  { path: '/signup',    element: <SignUp /> },
  { path: '/dashboard', element: <Dashboard /> },
])
```

---

### 전역 상태 사용 방법 (Zustand)

**상태 추가** `src/store/store.js`

```js
const useAppStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('ang_user') || 'null'),
  setUser: (user) => {
    localStorage.setItem('ang_user', JSON.stringify(user))
    set({ user })
  },
  clearUser: () => {
    localStorage.removeItem('ang_user')
    set({ user: null })
  },
}))
```

**컴포넌트에서 사용**

```jsx
import useAppStore from '../store/store'

function MyComponent() {
  const { user, setUser } = useAppStore()

  return <div>{user ? user.name : '로그인 필요'}</div>
}
```

---

### API 호출 방법

`src/api/authApi.js` 또는 `src/api/axios.js`를 사용합니다.

```js
import api from '../api/axios'
import { login, signUp } from '../api/authApi'

// 로그인
const response = await login({ empNo: 'EMP001', password: '1234' })

// 직접 호출
const data = await api.get('/api/health')
```

---

## API 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 백엔드 서버 상태 확인 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/signup` | 회원가입 |
| GET | `/api/member/me` | 내 정보 조회 |
| POST | `/chat` | AI 채팅 (AI 서버) |
| GET | `/health` | AI 서버 상태 확인 |

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
