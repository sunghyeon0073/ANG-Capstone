# ANG (Admin Next Generation) — 설치 매뉴얼

> 영진전문대학교 캡스톤 프로젝트 — 조직 문서 관리 및 실시간 협업 플랫폼
> 이 문서는 **프로젝트를 처음 받아서 실행·배포하는 방법**만 다룹니다.

| 구성 | 기술 | 포트 |
|------|------|------|
| Backend | Spring Boot 3.4 · Java 21 · Gradle | 9090 (`/api`) |
| Frontend | React 19 · Vite (운영: Nginx) | 5500 |
| AI | Python 3.12 · FastAPI · Anthropic Claude API | 8888 |
| DB | MariaDB | 3306 |
| 파일 저장 | AWS S3 | — |

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [프로젝트 클론](#2-프로젝트-클론)
3. [Docker 설치와 설정](#3-docker-설치와-설정)
4. [백엔드 설치 및 실행](#4-백엔드-설치-및-실행)
5. [프론트엔드 · AI 서버 실행](#5-프론트엔드--ai-서버-실행)
6. [CI/CD 설정](#6-cicd-설정)
7. [문제 해결](#7-문제-해결)

---

## 1. 사전 준비

| 도구 | 버전 | 용도 | 필수 |
|------|------|------|:----:|
| Git | 최신 | 클론 | ✅ |
| Docker Desktop / Docker Engine | 최신 | 전체 실행·배포 | ✅ |
| JDK | **21** | 백엔드를 직접 실행할 때 | 개발 시 |
| Node.js | **22** | 프론트를 직접 실행할 때 | 개발 시 |
| Python | **3.12** | AI 서버를 직접 실행할 때 | 개발 시 |
| Anthropic API Key | — | AI 기능 | ✅ |
| AWS S3 버킷 + IAM 키 | — | 파일 업로드 | 선택 |

> Docker로만 실행할 거라면 **Git + Docker**만 있으면 됩니다. JDK·Node·Python은 컨테이너 안에서 설치됩니다.

---

## 2. 프로젝트 클론

> ⚠️ 소스 코드는 **`dev` 브랜치**에 있습니다. (`main`에는 아직 README만 있습니다)

```bash
git clone -b dev https://github.com/sunghyeon0073/ANG-Capstone.git
cd ANG-Capstone
```

이미 `main`으로 받았다면:

```bash
git fetch origin
git checkout dev
```

클론이 잘 됐는지 확인 — 아래 폴더들이 보이면 성공입니다.

```
ANG-Capstone/
├── Backend/                 # Spring Boot
├── Frontend/                # React + Vite
├── AI/                      # FastAPI AI 서버
├── HwpBridge/               # (선택) 한글 문서 브릿지, Windows 전용
├── docker-compose.yml       # Backend + Frontend + AI
├── docker-compose.local.yml # 로컬용 MariaDB 추가
└── .github/workflows/       # ci.yml, cd.yml
```

---

## 3. Docker 설치와 설정

### 3-1. Docker 설치

**Windows**

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) 다운로드 후 설치
2. 설치 중 **Use WSL 2 instead of Hyper-V** 체크 (기본값)
3. 재부팅 후 Docker Desktop 실행 → 좌측 하단이 초록색(**Engine running**)이 될 때까지 대기
4. WSL 업데이트 요구 시 PowerShell(관리자)에서 `wsl --update`

**macOS**

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/)에서 본인 칩에 맞는 버전 설치 (Apple Silicon / Intel)
2. 응용 프로그램에서 Docker 실행 → 상단 메뉴바 고래 아이콘이 멈추면 준비 완료

**Ubuntu (AWS EC2 서버 포함)**

```bash
# Docker 공식 설치 스크립트
curl -fsSL https://get.docker.com | sudo sh

# sudo 없이 docker 쓰기
sudo usermod -aG docker $USER
newgrp docker

# 부팅 시 자동 실행
sudo systemctl enable --now docker
```

**설치 확인 (공통)**

```bash
docker --version
docker compose version
docker run --rm hello-world   # "Hello from Docker!" 가 나오면 성공
```

### 3-2. 환경 변수 파일(`.env`) 만들기

프로젝트 **루트**(`docker-compose.yml`과 같은 위치)에 `.env` 파일을 만듭니다.

```env
# ── DB ──
# 로컬 MariaDB 컨테이너를 쓸 때(docker-compose.local.yml)
DB_URL=jdbc:mariadb://db:3306/ang
DB_USERNAME=ang
DB_PASSWORD=ang_local_password
MARIADB_ROOT_PASSWORD=ang_root_password
# AWS RDS를 쓸 때는 위 DB_URL을 아래처럼 바꿈
# DB_URL=jdbc:mariadb://<RDS-엔드포인트>:3306/ang_db

# ── 인증 ──
JWT_SECRET=32자-이상의-랜덤-문자열을-넣으세요-abcdefghijklmnop
ADMIN_INIT_PASSWORD=qwer1234!

# ── AI ──
AI_BASE_URL=http://ai:8888
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-5

# ── AWS S3 ──
AWS_ACCESS_KEY_ID=dummy
AWS_SECRET_ACCESS_KEY=dummy
AWS_REGION=ap-northeast-3
S3_BUCKET=본인-버킷-이름
```

| 변수 | 설명 |
|------|------|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | 백엔드가 접속할 DB. **비어 있으면 컨테이너가 시작되지 않습니다** |
| `JWT_SECRET` | 로그인 토큰 서명 키. **32자 이상** 필수 |
| `ADMIN_INIT_PASSWORD` | 초기 관리자 비밀번호 |
| `AI_BASE_URL` | 백엔드 → AI 서버 주소. Docker 안에서는 `http://ai:8888` |
| `ANTHROPIC_API_KEY` | AI 기능용 키 ([console.anthropic.com](https://console.anthropic.com)) |
| `AWS_*`, `S3_BUCKET` | 파일 업로드용. 없으면 `dummy`로 두면 서버는 뜨고 업로드만 실패 |

> `.env`는 `.gitignore`에 등록되어 있습니다. **절대 커밋하지 마세요.**

### 3-3. Docker로 실행

```bash
# 로컬 개발: MariaDB 컨테이너까지 함께 실행
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build

# 서버(EC2): 외부 DB(RDS)를 쓰므로 기본 파일만
docker compose up -d --build
```

첫 빌드는 Gradle·npm·LibreOffice 설치 때문에 **5~10분** 걸립니다.

| 컨테이너 | 이름 | 주소 |
|----------|------|------|
| Frontend | `ang-frontend` | http://localhost:5500 |
| Backend | `ang-backend` | http://localhost:9090/api/health |
| AI | `ang-ai` | http://localhost:8888/health |
| DB (local만) | `ang-db` | localhost:3306 |

첫 실행 시 테이블과 테스트 계정이 자동 생성됩니다.

| 계정 | ID | 비밀번호 |
|------|----|----------|
| 최고관리자 | `admin` | `qwer1234!` |
| 원장 (김기종) | `manager` | `qwer1234!` |

### 3-4. 자주 쓰는 Docker 명령

```bash
docker compose ps                     # 컨테이너 상태 확인
docker compose logs -f backend        # 백엔드 로그 실시간 보기
docker compose restart backend        # 백엔드만 재시작
docker compose up -d --build backend  # 백엔드만 다시 빌드
docker compose down                   # 전체 종료
docker compose -f docker-compose.yml -f docker-compose.local.yml down -v   # DB 데이터까지 삭제
docker image prune -f                 # 안 쓰는 이미지 정리
```

---

## 4. 백엔드 설치 및 실행

Docker 없이 백엔드를 직접 띄워 개발할 때의 방법입니다.

### 4-1. JDK 21 설치

| OS | 설치 방법 |
|----|-----------|
| Windows | [Eclipse Temurin 21](https://adoptium.net/temurin/releases/?version=21) `.msi` 설치 → 설치 화면에서 **Set JAVA_HOME** 체크 |
| macOS | `brew install --cask temurin@21` |
| Ubuntu | `sudo apt update && sudo apt install -y openjdk-21-jdk` |

```bash
java -version   # openjdk version "21..." 이 나오면 성공
```

> Gradle은 따로 설치하지 않습니다. 프로젝트에 포함된 `gradlew`가 자동으로 받아옵니다.

### 4-2. DB 준비

MariaDB를 설치하지 않았다면 DB만 Docker로 띄웁니다.

```bash
docker run -d --name ang-db -p 3306:3306 \
  -e MARIADB_DATABASE=ang \
  -e MARIADB_USER=ang \
  -e MARIADB_PASSWORD=ang_local_password \
  -e MARIADB_ROOT_PASSWORD=ang_root_password \
  mariadb:11.4
```

테이블은 백엔드 첫 실행 시 JPA(`ddl-auto: update`)가 자동 생성합니다.

### 4-3. 환경 변수 설정 후 실행

백엔드 설정(`Backend/src/main/resources/application.yml`)은 값을 **환경 변수**에서 읽습니다.

**Windows (PowerShell)**

```powershell
cd Backend
$env:DB_URL="jdbc:mariadb://localhost:3306/ang"
$env:DB_USERNAME="ang"
$env:DB_PASSWORD="ang_local_password"
$env:JWT_SECRET="32자-이상의-랜덤-문자열을-넣으세요-abcdefghijklmnop"
$env:ADMIN_INIT_PASSWORD="qwer1234!"
$env:ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
$env:AWS_ACCESS_KEY_ID="dummy"
$env:AWS_SECRET_ACCESS_KEY="dummy"
.\gradlew.bat bootRun
```

**macOS / Linux**

```bash
cd Backend
export DB_URL="jdbc:mariadb://localhost:3306/ang"
export DB_USERNAME=ang
export DB_PASSWORD=ang_local_password
export JWT_SECRET="32자-이상의-랜덤-문자열을-넣으세요-abcdefghijklmnop"
export ADMIN_INIT_PASSWORD="qwer1234!"
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
export AWS_ACCESS_KEY_ID=dummy
export AWS_SECRET_ACCESS_KEY=dummy
chmod +x gradlew
./gradlew bootRun
```

로그에 `Started SpringBootDeveloperApplication`이 보이면 http://localhost:9090/api/health 로 확인합니다.

### 4-4. IntelliJ에서 실행

1. **File → Open** → `ANG-Capstone/Backend` 폴더 선택 (Gradle 프로젝트로 열림)
2. **File → Project Structure → SDK**를 **21**로 지정
3. `SpringBootDeveloperApplication` 실행 구성 → **Modify options → Environment variables**에 4-3의 값을 `KEY=VALUE;KEY=VALUE` 형식으로 입력
4. ▶ 실행

> 환경 변수 대신 `application-local.yml.example`을 복사해 `application-local.yml`로 만들고 `${...}` 자리에 실제 값을 넣어도 됩니다. (Git에 올라가지 않음)

### 4-5. JAR로 빌드

```bash
cd Backend
./gradlew bootJar            # Windows: .\gradlew.bat bootJar
java -jar build/libs/*.jar   # 환경 변수가 설정된 터미널에서 실행
```

---

## 5. 프론트엔드 · AI 서버 실행

**Frontend** (Node.js 22)

```bash
cd Frontend
npm install
npm run dev        # http://localhost:5500 자동 열림
```

`/api` 요청(WebSocket 포함)은 Vite 프록시가 `http://127.0.0.1:9090`으로 넘겨줍니다.

**AI 서버** (Python 3.12)

```bash
cd AI
python -m venv .venv
source .venv/bin/activate          # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env  → 키 입력
uvicorn main:app --reload --port 8888 --env-file .env
```

---

## 6. CI/CD 설정

GitHub Actions로 **CI(빌드 검증)**와 **CD(EC2 자동 배포)**를 합니다.

```
개발자 push / PR
      │
      ▼
┌──────────────┐  main · dev · dev-server · test-server
│  CI (ci.yml) │  Backend / Frontend / AI 빌드 + Dockerfile 빌드 검증
└──────┬───────┘
       │ dev 또는 dev-server 에 push 되면
       ▼
┌──────────────┐  GitHub → EC2 SSH 접속
│  CD (cd.yml) │  git reset --hard → docker compose down → up -d --build
└──────────────┘
```

### 6-1. CI — `.github/workflows/ci.yml`

| 항목 | 내용 |
|------|------|
| 실행 조건 | `main`, `dev`, `dev-server`, `test-server`에 **push 또는 PR** |
| backend | JDK 21 → `./gradlew bootJar` → `Backend/Dockerfile` 빌드 확인 |
| frontend | Node 22 → `npm install && npm run build` → `Frontend/Dockerfile` 빌드 확인 |
| ai | Python 3.12 → `pip install -r requirements.txt` → `AI/Dockerfile` 빌드 확인 |

별도 설정은 필요 없습니다. PR 화면의 **Checks**에서 결과를 확인하고, ❌가 뜨면 **Details**에서 로그를 확인합니다.

### 6-2. CD — `.github/workflows/cd.yml`

`dev` 또는 `dev-server` 브랜치에 push(= PR merge)되면 EC2에 SSH로 접속해 아래를 실행합니다.

```bash
cd $DEPLOY_PATH
git fetch origin
git checkout <브랜치>
git reset --hard origin/<브랜치>
docker compose down
docker compose up -d --build
docker image prune -f
```

#### ① EC2 서버 준비 (최초 1회)

1. **EC2 인스턴스 생성** — Ubuntu 22.04/24.04, 메모리 4GB 이상 권장 (빌드 시 Gradle·npm·LibreOffice 사용)
2. **보안 그룹 인바운드 규칙**

   | 포트 | 용도 |
   |------|------|
   | 22 | SSH (GitHub Actions 접속) |
   | 5500 | 웹 화면 |
   | 9090 | 백엔드 API (필요 시) |

3. **Docker 설치** — [3-1 Ubuntu](#3-1-docker-설치) 명령 실행
4. **프로젝트 클론**

   ```bash
   cd ~
   git clone -b dev https://github.com/sunghyeon0073/ANG-Capstone.git
   cd ANG-Capstone
   pwd    # 이 경로가 DEPLOY_PATH (예: /home/ubuntu/ANG-Capstone)
   ```

5. **`.env` 작성** — [3-2](#3-2-환경-변수-파일env-만들기) 참고. 서버에서는 `DB_URL`을 RDS 주소로 지정
6. **수동으로 한 번 실행해 보기**

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

#### ② SSH 키 준비

GitHub Actions가 EC2에 접속할 때 쓸 키입니다. EC2 생성 시 받은 `.pem` 키를 그대로 써도 되고, 배포 전용 키를 새로 만들어도 됩니다.

```bash
# (배포 전용 키를 만들 경우) EC2 서버에서
ssh-keygen -t ed25519 -f ~/.ssh/ang_deploy -N ""
cat ~/.ssh/ang_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/ang_deploy        # 출력된 개인키 전체를 복사 → DEPLOY_KEY 에 등록
```

#### ③ GitHub Secrets 등록

저장소 **Settings → Secrets and variables → Actions → New repository secret**

| Secret 이름 | 값 예시 |
|-------------|---------|
| `DEPLOY_HOST` | EC2 퍼블릭 IP 또는 도메인 (예: `15.168.xxx.xxx`) |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_KEY` | 개인키 전체 (`-----BEGIN ... KEY-----`부터 `-----END ... KEY-----`까지) |
| `DEPLOY_PATH` | `/home/ubuntu/ANG-Capstone` |

#### ④ 배포 확인

1. `dev` 브랜치로 PR을 merge
2. 저장소 **Actions** 탭 → **CD Deploy** 워크플로 클릭
3. 로그에 `===== DEPLOY COMPLETE =====`가 보이면 성공
4. `http://<EC2-IP>:5500` 접속해 확인

> ⚠️ CD는 서버에서 `git reset --hard`를 실행합니다. **EC2에서 직접 수정한 코드는 배포 때 사라집니다.** (`.env`는 Git 추적 대상이 아니라 유지됩니다)

---

## 7. 문제 해결

| 증상 | 원인 / 해결 |
|------|-------------|
| 클론했는데 README만 있음 | `main` 브랜치를 받음 → `git checkout dev` |
| `DB_URL is required` | 루트에 `.env`가 없거나 값이 비어 있음 |
| `Cannot connect to the Docker daemon` | Docker Desktop이 꺼져 있음 / Ubuntu는 `sudo systemctl start docker` |
| `permission denied ... docker.sock` | `sudo usermod -aG docker $USER` 후 재접속 |
| 백엔드 `Communications link failure` | DB가 안 떴거나 주소가 틀림 → `docker compose ps`로 DB 확인 |
| `WeakKeyException` (JWT) | `JWT_SECRET`이 32자 미만 |
| `./gradlew: Permission denied` | `chmod +x gradlew` |
| `Port 5500 is already in use` | VS Code Live Server 등 다른 프로그램 종료 |
| EC2 빌드 중 멈춤 / 컨테이너 종료 | 메모리 부족 → 인스턴스 크기 상향 또는 스왑 추가 |
| CD `ssh: handshake failed` | `DEPLOY_KEY` 줄바꿈 누락, `DEPLOY_USER` 오타, 보안 그룹 22번 포트 확인 |
| CD `cd: ... No such file or directory` | `DEPLOY_PATH`가 EC2의 실제 클론 경로와 다름 |
| AI 기능 500 에러 | `ANTHROPIC_API_KEY` 확인, AI 컨테이너 실행 여부 확인 |
