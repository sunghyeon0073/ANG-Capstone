# HWP Bridge

Windows host에서 설치된 한컴오피스 한글을 COM 자동화로 제어하는 작은 브릿지 서버입니다.

## Requirements

- Windows
- 한컴오피스 한글 설치
- Python 3.11+

## Install

```powershell
cd HwpBridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
uvicorn main:app --host 0.0.0.0 --port 8877
```

프로젝트 루트에서 아래 헬퍼를 쓰면 HWP Bridge와 Docker Compose를 같이 올릴 수 있습니다.

```powershell
.\scripts\dev-up-with-hwp.ps1
```

백엔드에는 아래 환경변수를 설정합니다.

```text
HWP_EDIT_BASE_URL=http://<windows-host-ip>:8877
```

## API

`POST /hwp/replace`

Multipart form fields:

- `file`: 원본 `.hwp`
- `replacements`: JSON 배열 문자열
- `output_format`: `hwp`, `pdf`, `docx`

`POST /hwp/preview-pdf`

Multipart form fields:

- `file`: 원본 `.hwp`

한컴으로 원본 HWP를 열고 PDF로 저장해서 미리보기용 PDF를 반환합니다.

Example `replacements`:

```json
[
  { "find": "홍길동", "replace": "김철수" },
  { "find": "2026.05.27", "replace": "2026.06.01" }
]
```

Note: 한컴 버전에 따라 `docx` 저장 format name이 다를 수 있습니다. 필요하면 `HWP_SAVE_FORMAT_DOCX` 환경변수로 조정하세요.
