import json
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path

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


@app.get("/health")
def health():
    return {
        "status": "ok" if pythoncom and win32com else "missing-pywin32",
        "message": "HWP bridge is running",
    }


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
