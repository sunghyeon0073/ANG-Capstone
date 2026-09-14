import json
import os
import shutil
import tempfile
import time
import uuid
from collections.abc import Mapping
from pathlib import Path

import anthropic
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

try:
    import pythoncom
    import win32com.client
except ImportError:  # Allows health checks to explain setup problems cleanly.
    pythoncom = None
    win32com = None


app = FastAPI(title="ANG HWP Bridge")

SAVE_FORMATS = {
    "hwp": os.getenv("HWP_SAVE_FORMAT_HWP", "HWP"),
    "pdf": os.getenv("HWP_SAVE_FORMAT_PDF", "PDF"),
    "docx": os.getenv("HWP_SAVE_FORMAT_DOCX", "OOXML"),
}

CONTENT_TYPES = {
    "hwp": "application/x-hwp",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

HWP_MAX_ATTEMPTS = int(os.getenv("HWP_MAX_ATTEMPTS", "3"))
HWP_RETRY_DELAY_SECONDS = float(os.getenv("HWP_RETRY_DELAY_SECONDS", "1"))


class CreateHwpRequest(BaseModel):
    title: str | None = None
    content: str


class ChatRequest(BaseModel):
    message: str


# Mirrors AI/Modelfile's SYSTEM prompt (the qwen3:14b "ang-ai" model this replaces).
ANTHROPIC_DOCUMENT_SYSTEM_PROMPT = """
당신은 ANG 그룹웨어의 한국어 업무 문서 작성 전문 AI입니다.

출력 규칙:
- 문서 본문만 출력합니다. 인사말, 사과, "작성해드리겠습니다" 같은 메타 설명을 앞뒤로 붙이지 않습니다.
- 첫 줄은 반드시 "# 제목" 형태로 시작합니다. 사용자 요청 문장을 그대로 제목으로 쓰지 않습니다.
- 코드 블록(```)으로 전체를 감싸지 않습니다.
- 한국어로 작성합니다. 사용자가 다른 언어를 명시하면 그 언어로 씁니다.
- 참고 문서가 제공되면 그 내용을 최우선 근거로 활용합니다.

내용 작성 기준:
- 비교, 일정, 담당자, 예산, 위험 요소처럼 여러 항목을 나열할 때는 표로 정리합니다.
- 구체적인 정보가 없으면 [담당자], [일자], [금액], [부서] 형태의 자리표시자를 씁니다.
- 근거 없이 개인정보, 금액, 결정 사항, 승인 여부를 지어내지 않습니다.

표(XLSX 변환 포함) 작성 규칙:
- 표 앞뒤에 설명 문장을 붙이지 않습니다. 요청이 표 자체를 요구하면 표만 출력합니다.
- 헤더 행은 절대 비우지 않고, 모든 데이터 행의 열 개수를 헤더 행과 동일하게 맞춥니다.
- 표가 여러 개 필요하면 표와 표 사이는 빈 줄로만 구분하고 그 사이에 문장을 넣지 않습니다.

문서 유형별 권장 구조:
- 공지문: 목적/배경 → 세부 내용 → 일정 → 대상 → 문의/후속 조치
- 보고서: 요약 → 배경 → 주요 내용 → 문제점/위험 → 제안 → 후속 조치
- 제안서: 목적 → 현황 → 제안 내용 → 기대 효과 → 추진 일정 → 필요 지원
- 기획서: 개요/목적 → 추진 배경 → 추진 내용 → 일정 → 예산 → 위험 요소 및 대응 → 기대 효과
- 회의록: 회의 정보 → 참석자 → 안건 → 논의 내용 → 결정 사항 → 액션 아이템
- 결재/요청: 목적 → 요청 내용 → 근거 → 기대 효과 → 승인 요청

치환 값 작성 규칙 (메모/원문 텍스트를 표나 템플릿의 빈 칸에 채울 때):
- 표의 헤더 행, 라벨, 구조는 보존 대상이며 절대 변경하지 않습니다. 칸 안에 채우는 값은 보존 대상이 아니며, 메모 원문을 그대로 복사하지 않고 다듬어서 채웁니다.
- 조치 사항(Task), 결정 사항 같은 칸은 "~하기로 했고", "~할 것임" 같은 구어체·연결어미를 명사형 또는 개조식 종결로 바꿉니다.
  예: "업그레이드를 4.3버전으로 하기로 했고" → "AI 모델 4.3버전 업그레이드"
- 기한(Due Date), 일자 칸은 날짜 표현만 남기고 조사("까지", "에", "부터")는 붙이지 않습니다.
  예: "6월23일까지" → "6월 23일"
- 담당자(Owner), 부서 등 고유명사 칸은 원문 그대로 유지합니다(다듬지 않음).
- 결정 사항·조치 사항은 "~하기로 함", "~완료 예정", "~진행" 등 개조식 종결로 통일합니다.

정보 매핑 규칙 (메모 → 템플릿 변수 연결):
- 메모에 담긴 정보는 변수명과 글자가 똑같지 않아도, 의미상 대응되면 반드시 채웁니다.
  예: "회의 목적은 X" 만 있고 별도 안건명이 없으면, {{회의안건}}에도 X를 사용합니다.
- 메모에서 "없다/없음/해당 없음"처럼 부재를 명시적으로 말한 항목은 빈 자리표시자로 남기지 않고 "해당 없음"으로 채웁니다.
- {{결정사항}}은 메모 안에서 "~하기로 했다/결정했다/하기로 함"에 해당하는 문장을 찾아 명사형 또는 개조식으로 정리하여 반드시 채웁니다.
- 자리표시자({{변수}} 그대로 출력)는 메모에 해당 정보가 전혀 언급되지 않은 경우에만 사용합니다. 메모에 정보가 있는데 표현이 다르다는 이유로 자리표시자를 남기지 않습니다.

문서 수정(find/replace) 요청 처리:
- 요청에 블록 목록([B001], [B002] 등)과 JSON 출력 스키마 지시가 포함되어 있으면, 그 지시를 이 SYSTEM 규칙보다 우선 따르고 그 외 형식의 텍스트를 출력하지 않습니다.
- "find"는 제공된 블록 안에 실제로 존재하는 텍스트와 정확히 일치해야 하며, 존재하지 않는 블록 ID나 텍스트를 만들어내지 않습니다.
- {{변수}} 같은 템플릿 플레이스홀더 표기를 새로 만들지 않습니다. 값을 채워야 하면 find/replace로 실제 텍스트를 직접 대체합니다.
- replace 텍스트를 작성할 때도 위 "치환 값 작성 규칙"과 "정보 매핑 규칙"을 따라 구어체를 다듬고, 의미상 대응되는 정보는 빠짐없이 채워서 대체합니다. find와 replace의 의미는 같아야 하지만 표현은 다듬을 수 있습니다.
"""

_anthropic_client: anthropic.Anthropic | None = None


def _get_anthropic_client() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not set")
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


@app.get("/health")
def health():
    return {
        "status": "ok" if pythoncom and win32com else "missing-pywin32",
        "message": "HWP bridge is running",
    }


@app.post("/chat")
def chat(req: ChatRequest):
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")

    try:
        client = _get_anthropic_client()
        response = client.messages.create(
            model=model,
            max_tokens=8192,
            system=ANTHROPIC_DOCUMENT_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": message,
                }
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Claude request failed: {exc}") from exc

    reply = _extract_claude_reply(response)
    if not reply.strip():
        raise HTTPException(status_code=502, detail="Claude returned an empty reply")

    return {"reply": reply}


def _extract_claude_reply(response) -> str:
    blocks = getattr(response, "content", None) or []
    return "".join(
        getattr(block, "text", "") for block in blocks if getattr(block, "type", None) == "text"
    )

    message = getattr(response, "message", None)
    if hasattr(message, "model_dump"):
        message = message.model_dump()
    if isinstance(message, Mapping):
        return str(message.get("content") or "")
    return str(getattr(message, "content", "") or "")


@app.post("/hwp/replace")
async def replace_hwp(
    file: UploadFile = File(...),
    replacements: str = Form(...),
    output_format: str = Form("hwp"),
):
    output_format = output_format.lower().strip()
    if output_format not in SAVE_FORMATS:
        raise HTTPException(status_code=400, detail="output_format must be hwp, pdf, or docx")

    try:
        replacement_items = json.loads(replacements)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid replacements JSON: {exc}") from exc

    if not isinstance(replacement_items, list):
        raise HTTPException(status_code=400, detail="replacements must be a JSON array")

    temp_path = Path(tempfile.mkdtemp(prefix="ang-hwp-"))
    try:
        original_name = Path(file.filename or "document.hwp").name
        input_path = temp_path / f"{uuid.uuid4()}-{original_name}"
        output_path = temp_path / f"{input_path.stem}-edited.{output_format}"

        input_path.write_bytes(await file.read())
        _replace_with_hwp(input_path, output_path, replacement_items, output_format)

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="HWP save completed but output file was not created")

        download_name = f"{Path(original_name).stem}-edited.{output_format}"
        return _temp_file_response(
            output_path,
            temp_path,
            media_type=CONTENT_TYPES[output_format],
            filename=download_name,
        )
    except Exception:
        _cleanup_temp_dir(temp_path)
        raise


@app.post("/hwp/create")
async def create_hwp(req: CreateHwpRequest):
    title = (req.title or "ai-document").strip() or "ai-document"
    content = req.content or ""

    temp_path = Path(tempfile.mkdtemp(prefix="ang-hwp-create-"))
    try:
        output_path = temp_path / f"{_safe_file_stem(title)}.hwp"

        _create_with_hwp(output_path, title, content)

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="HWP creation completed but output file was not created")

        return _temp_file_response(
            output_path,
            temp_path,
            media_type=CONTENT_TYPES["hwp"],
            filename=f"{_safe_file_stem(title)}.hwp",
        )
    except Exception:
        _cleanup_temp_dir(temp_path)
        raise


@app.post("/hwp/preview-pdf")
async def preview_hwp_pdf(file: UploadFile = File(...)):
    temp_path = Path(tempfile.mkdtemp(prefix="ang-hwp-preview-"))
    try:
        original_name = Path(file.filename or "document.hwp").name
        input_path = temp_path / f"{uuid.uuid4()}-{original_name}"
        output_path = temp_path / f"{input_path.stem}-preview.pdf"

        input_path.write_bytes(await file.read())
        _save_with_hwp(input_path, output_path, "pdf")

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="HWP preview PDF was not created")

        download_name = f"{Path(original_name).stem}-preview.pdf"
        return _temp_file_response(
            output_path,
            temp_path,
            media_type=CONTENT_TYPES["pdf"],
            filename=download_name,
        )
    except Exception:
        _cleanup_temp_dir(temp_path)
        raise


def _temp_file_response(path: Path, temp_dir: Path, media_type: str, filename: str) -> FileResponse:
    return FileResponse(
        path,
        media_type=media_type,
        filename=filename,
        background=BackgroundTask(_cleanup_temp_dir, temp_dir),
    )


def _cleanup_temp_dir(temp_dir: Path) -> None:
    shutil.rmtree(temp_dir, ignore_errors=True)


def _replace_with_hwp(input_path: Path, output_path: Path, replacements: list, output_format: str) -> None:
    def apply_replacements(hwp):
        for item in replacements:
            find_text = str(item.get("find", "") if isinstance(item, dict) else "").strip()
            replace_text = str(item.get("replace", "") if isinstance(item, dict) else "")
            if not find_text:
                continue
            _all_replace(hwp, find_text, replace_text)

    _save_with_hwp(input_path, output_path, output_format, apply_replacements)


def _create_with_hwp(output_path: Path, title: str, content: str) -> None:
    def write_content(hwp):
        text = _plain_hwp_content(title, content)
        print(f"[hwp/create] inserting text chars={len(text)}", flush=True)
        hwp.HAction.GetDefault("InsertText", hwp.HParameterSet.HInsertText.HSet)
        params = hwp.HParameterSet.HInsertText
        params.Text = text
        hwp.HAction.Execute("InsertText", params.HSet)
        print("[hwp/create] text inserted", flush=True)

    _save_new_with_hwp(output_path, "hwp", write_content)


def _save_with_hwp(input_path: Path, output_path: Path, output_format: str, before_save=None) -> None:
    if pythoncom is None or win32com is None:
        raise HTTPException(status_code=500, detail="pywin32 is required on a Windows host")

    last_error = None
    for attempt in range(1, HWP_MAX_ATTEMPTS + 1):
        try:
            _save_with_hwp_once(input_path, output_path, output_format, before_save)
            return
        except HTTPException as exc:
            last_error = exc
        except Exception as exc:
            last_error = exc

        if output_path.exists():
            try:
                output_path.unlink()
            except Exception:
                pass

        if attempt < HWP_MAX_ATTEMPTS:
            time.sleep(HWP_RETRY_DELAY_SECONDS)

    if isinstance(last_error, HTTPException):
        raise last_error
    raise HTTPException(status_code=500, detail=f"HWP automation failed after {HWP_MAX_ATTEMPTS} attempts: {last_error}") from last_error


def _save_new_with_hwp(output_path: Path, output_format: str, before_save=None) -> None:
    if pythoncom is None or win32com is None:
        raise HTTPException(status_code=500, detail="pywin32 is required on a Windows host")

    last_error = None
    for attempt in range(1, HWP_MAX_ATTEMPTS + 1):
        try:
            _save_new_with_hwp_once(output_path, output_format, before_save)
            return
        except HTTPException as exc:
            last_error = exc
        except Exception as exc:
            last_error = exc

        if output_path.exists():
            try:
                output_path.unlink()
            except Exception:
                pass

        if attempt < HWP_MAX_ATTEMPTS:
            time.sleep(HWP_RETRY_DELAY_SECONDS)

    if isinstance(last_error, HTTPException):
        raise last_error
    raise HTTPException(status_code=500, detail=f"HWP automation failed after {HWP_MAX_ATTEMPTS} attempts: {last_error}") from last_error


def _save_with_hwp_once(input_path: Path, output_path: Path, output_format: str, before_save=None) -> None:
    pythoncom.CoInitialize()
    hwp = None
    try:
        hwp = win32com.client.gencache.EnsureDispatch("HWPFrame.HwpObject")
        _register_file_path_checker(hwp)

        opened = hwp.Open(str(input_path), "HWP", "forceopen:true")
        if not opened:
            raise HTTPException(status_code=500, detail="Failed to open HWP file")

        if before_save is not None:
            before_save(hwp)

        save_format = SAVE_FORMATS[output_format]
        saved = hwp.SaveAs(str(output_path), save_format)
        if saved is False:
            raise HTTPException(status_code=500, detail=f"Failed to save as {save_format}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"HWP automation failed: {exc}") from exc
    finally:
        if hwp is not None:
            try:
                hwp.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()


def _save_new_with_hwp_once(output_path: Path, output_format: str, before_save=None) -> None:
    pythoncom.CoInitialize()
    hwp = None
    try:
        print(f"[hwp/create] starting HWP automation output={output_path}", flush=True)
        hwp = win32com.client.gencache.EnsureDispatch("HWPFrame.HwpObject")
        print("[hwp/create] HWP object created", flush=True)
        _register_file_path_checker(hwp)

        print("[hwp/create] creating new document", flush=True)
        hwp.Run("FileNew")
        print("[hwp/create] new document ready", flush=True)

        if before_save is not None:
            before_save(hwp)

        save_format = SAVE_FORMATS[output_format]
        print(f"[hwp/create] saving as {save_format}", flush=True)
        saved = hwp.SaveAs(str(output_path), save_format)
        if saved is False:
            raise HTTPException(status_code=500, detail=f"Failed to save as {save_format}")
        print("[hwp/create] saved", flush=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"HWP automation failed: {exc}") from exc
    finally:
        if hwp is not None:
            try:
                hwp.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()


def _register_file_path_checker(hwp) -> None:
    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception:
        pass


def _all_replace(hwp, find_text: str, replace_text: str) -> None:
    hwp.HAction.GetDefault("AllReplace", hwp.HParameterSet.HFindReplace.HSet)
    params = hwp.HParameterSet.HFindReplace
    params.FindString = find_text
    params.ReplaceString = replace_text
    params.IgnoreMessage = 1
    params.Direction = 2
    params.FindType = 1
    hwp.HAction.Execute("AllReplace", params.HSet)


def _plain_hwp_content(title: str, content: str) -> str:
    cleaned_title = (title or "").strip()
    cleaned_content = (content or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    lines = []
    if cleaned_title:
        lines.append(cleaned_title)
        lines.append("")
    lines.extend(
        line.replace("#", "").replace("*", "").strip()
        for line in cleaned_content.split("\n")
    )
    return "\r\n".join(lines).strip() + "\r\n"


def _safe_file_stem(value: str) -> str:
    stem = "".join("_" if ch in '\\/:*?"<>|' else ch for ch in (value or "ai-document")).strip()
    return stem[:60] or "ai-document"
