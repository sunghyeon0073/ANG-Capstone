# Ang Project

> Spring Boot + Vite + FastAPI + Ollama 기반 풀스택 프로젝트

---

## 기술 스택

### Runtime
| | 버전 |
|--|------|
| Node.js | 22.19.0 |
| Java | 21 |
| Python | 3.12.4 |

### Frontend
| 라이브러리 | 버전 |
|-----------|------|
| React | 19.2.5 |
| React Router DOM | 7.14.2 |
| Zustand | 5.0.12 |
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
| MariaDB | 12.0.2 |

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

## 서버 실행 방법

> CMD 창을 **3개** 열어서 각각 실행하세요.

### 1. 백엔드

```cmd
cd C:\JDEV\Ang\Backend
gradlew.bat bootRun
```

`Started SpringBootDeveloperApplication` 로그가 뜨면 완료

### 2. 프론트엔드

```cmd
cd C:\JDEV\Ang\Frontend
npm run dev
```

`http://localhost:5500` 접속

### 3. AI 서버

```cmd
cd C:\JDEV\Ang\AI
pip install -r requirements.txt
uvicorn main:app --reload --port 8888
```

> Ollama가 먼저 실행되어 있어야 합니다 (`ollama serve`)

---

## 연동 테스트

백엔드 + 프론트엔드 실행 후 `http://localhost:5500` 접속  
**연결 테스트** 버튼을 누르면 백엔드 응답이 화면에 표시됩니다.

```
사용자
  ↓ 브라우저에서 클릭
Frontend (5500)
  ↓ /api 요청 → Vite 프록시
Backend (9090)
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
│   ├── SecurityConfig  ← 보안 설정 (추후 활성화 예정)
│   └── OllamaConfig    ← AI 연결 설정
├── security/           ← JWT 로그인/토큰 (추후 활성화 예정)
└── domain/             ← ⭐ 기능 개발은 여기에
    └── user/           ← 예시 구조
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
├── assets/          ← 이미지, 폰트 등 정적 파일
├── components/
│   └── common/      ← 여러 페이지에서 재사용하는 UI (Button, Modal 등)
├── hooks/           ← 커스텀 훅 (useXxx.js)
├── pages/           ← 라우트별 페이지 컴포넌트
│   ├── Home/
│   │   └── Home.jsx
│   └── NotFound/
│       └── NotFound.jsx
├── router/
│   └── index.jsx    ← 페이지 경로(URL) 설정
├── services/
│   └── api.js       ← 백엔드 API 호출 함수
├── store/
│   └── index.js     ← 전역 상태 (Zustand)
├── styles/
│   └── global.css   ← 전체 공통 스타일
├── utils/           ← 날짜 포맷, 유효성 검사 등 공통 함수
├── App.jsx
└── main.jsx
```

### 페이지 추가 방법

**1. 페이지 파일 생성** `src/pages/Board/Board.jsx`

```jsx
function Board() {
  return <div>게시판 페이지</div>
}

export default Board
```

**2. 라우터에 경로 등록** `src/router/index.jsx`

```jsx
import Board from '../pages/Board/Board'

const router = createBrowserRouter([
  { path: '/',      element: <Home /> },
  { path: '/board', element: <Board /> },  // 추가
  { path: '*',      element: <NotFound /> },
])
```

---

### 전역 상태 사용 방법 (Zustand)

**상태 추가** `src/store/index.js`

```js
const useAppStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),

  // 상태 추가 예시
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))
```

**컴포넌트에서 사용**

```jsx
import useAppStore from '../../store'

function MyComponent() {
  const { user, setUser } = useAppStore()

  return <div>{user ? user.name : '로그인 필요'}</div>
}
```

---

### API 호출 방법

`src/services/api.js`의 `api` 객체를 사용합니다.  
모든 요청은 Vite 프록시를 통해 백엔드(9090)로 전달됩니다.

```js
import { api } from '../../services/api'

// GET
const data = await api.get('/health')

// POST
const result = await api.post('/users/login', { email, password })

// PUT
await api.put('/users/1', { name: '홍길동' })

// DELETE
await api.delete('/users/1')
```

---

## 로컬 환경 설정

### 백엔드 환경변수

`Backend/src/main/resources/application-local.yml.example` 파일을 복사해서  
`application-local.yml` 로 이름 변경 후 값을 채워주세요.

```yaml
DB_URL: jdbc:mariadb://localhost:3306/ang_db?useSSL=false&serverTimezone=Asia/Seoul
DB_USERNAME: root
DB_PASSWORD: 비밀번호
JWT_SECRET: 256비트-이상의-시크릿-키
ADMIN_INIT_PASSWORD: 초기관리자비밀번호
OLLAMA_BASE_URL: http://localhost:11434
OLLAMA_MODEL: qwen3:8b
```

### AI 환경변수

`AI/.env.example` 파일을 복사해서 `.env` 로 이름 변경 후 값을 채워주세요.

```
OLLAMA_MODEL=qwen3:8b
OLLAMA_HOST=http://localhost:11434
```

---

## 팀 개발 흐름

### 브랜치 전략

```
main        ← 최종 완성본만 올라오는 곳 (건드리지 않음)
  └── develop   ← 팀원 작업물이 합쳐지는 곳
        └── feature/기능명   ← 각자 기능 개발하는 곳
```

### 작업 순서

```
① develop 브랜치에서 내 브랜치 만들기
② 내 브랜치에서 기능 개발
③ GitHub에 push 후 PR(Pull Request) 올리기
④ 팀원 코드 확인 후 develop에 merge
⑤ git pull로 최신 코드 내려받기
⑥ 기능 다 모이면 DB 연동 후 통합 테스트
⑦ 문제 없으면 main에 merge (최종본)
```

### 브랜치 이름 규칙

```
feature/기능명      ← 새 기능 개발   예) feature/user-login
fix/버그내용        ← 버그 수정      예) fix/login-error
design/페이지명     ← UI 작업        예) design/main-page
```

### 자주 쓰는 명령어

```cmd
# develop 브랜치로 이동
git checkout develop

# 내 브랜치 만들기
git checkout -b feature/기능명

# 작업 저장
git add .
git commit -m "feat: 기능 설명"

# GitHub에 올리기
git push origin feature/기능명
```

---

## 로컬 개발 → 통합 테스트 흐름

```
각자 로컬에서 기능 개발 (DB 걱정 없이 코드만 작성)
       ↓
GitHub에 push & PR 올리기
       ↓
팀원 코드 확인 후 develop에 merge
       ↓
git pull로 최신 코드 내려받기
       ↓
기능 다 모이면 MariaDB 연동 후 통합 테스트
       ↓
main에 merge (최종본 완성)
```

> `application-local.yml`은 각자 본인 DB 설정으로 세팅하세요.  
> 이 파일은 `.gitignore`에 등록되어 있어서 GitHub에 올라가지 않습니다.

---

## ⛔ 금칙사항

### Git 관련

| 금지 | 이유 |
|------|------|
| `main`에 직접 push | 전체 코드가 망가질 수 있음 |
| `git push --force` | 다른 팀원 작업이 사라질 수 있음 |
| PR 없이 develop에 직접 merge | 코드 리뷰 없이 합쳐지면 버그 추적 불가 |
| 팀원 리뷰 없이 본인이 본인 PR merge | 혼자 검토하면 실수를 못 잡음 |

### 코드 관련

| 금지 | 이유 |
|------|------|
| `application-local.yml` 커밋 | DB 비밀번호, JWT 시크릿 등 민감 정보 노출 |
| `.env` 커밋 | AI 서버 환경변수 노출 |
| 다른 팀원 브랜치에 직접 push | 작업 충돌 발생 |
| `develop`, `main` 브랜치에서 직접 작업 | 항상 feature 브랜치 만들어서 작업 |

---

## API 목록

| 메서드 | 경로 | 설명            |
|--------|------|---------------|
| GET | `/api/health` | 백엔드 서버 상태 확인  |
| POST | `/chat` | AI "채팅 (AI 서버) |
| GET | `/health` | AI 서버 상태 확인   |
