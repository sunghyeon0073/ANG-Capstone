import os
import json
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

try:
    import pythoncom
    import win32com.client
except ImportError:
    pythoncom = None
    win32com = None

from pydantic import BaseModel

router = APIRouter(prefix="/hwp")

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

class CreateHwpRequest(BaseModel):
    title: str | None = None
    content: str

@router.post("/replace")
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

@router.post("/create")
async def create_hwp(req: CreateHwpRequest):
    content = (req.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    temp_path = Path(tempfile.mkdtemp(prefix="ang-hwp-"))
    try:
        output_format = "hwp"
        base_name = req.title.strip() if req.title and req.title.strip() else f"Created_{uuid.uuid4().hex[:8]}"
        if base_name.lower().endswith(f".{output_format}"):
            base_name = base_name[:-len(output_format)-1]

        output_path = temp_path / f"{base_name}.{output_format}"
        _create_with_hwp(content, output_path)

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="HWP creation completed but output file was not created")

        download_name = f"{base_name}.{output_format}"
        return _temp_file_response(
            output_path,
            temp_path,
            media_type=CONTENT_TYPES[output_format],
            filename=download_name,
        )
    except Exception:
        _cleanup_temp_dir(temp_path)
        raise

def _replace_with_hwp(input_path: Path, output_path: Path, replacements: list[dict], output_format: str):
    if not pythoncom or not win32com:
        raise HTTPException(status_code=500, detail="pywin32 is not installed or available.")

    pythoncom.CoInitialize()
    hwp = None
    try:
        hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
        hwp.RegisterModule("FilePathCheckDLL", "SecurityModule")
        hwp.Open(str(input_path.resolve()))

        for rep in replacements:
            find_text = rep.get("find")
            replace_text = rep.get("replace")
            if not find_text or replace_text is None:
                continue

            hwp.HAction.GetDefault("AllReplace", hwp.HParameterSet.HFindReplace.HSet)
            hwp.HParameterSet.HFindReplace.FindString = find_text
            hwp.HParameterSet.HFindReplace.ReplaceString = replace_text
            hwp.HParameterSet.HFindReplace.IgnoreMessage = 1
            hwp.HAction.Execute("AllReplace", hwp.HParameterSet.HFindReplace.HSet)

        hwp.SaveAs(str(output_path.resolve()), SAVE_FORMATS[output_format])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"HWP automation error: {exc}") from exc
    finally:
        if hwp:
            try:
                hwp.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

def _create_with_hwp(content: str, output_path: Path):
    if not pythoncom or not win32com:
        raise HTTPException(status_code=500, detail="pywin32 is not installed or available.")

    pythoncom.CoInitialize()
    hwp = None
    try:
        hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
        hwp.RegisterModule("FilePathCheckDLL", "SecurityModule")
        
        # Insert text
        hwp.HAction.GetDefault("InsertText", hwp.HParameterSet.HInsertText.HSet)
        hwp.HParameterSet.HInsertText.Text = content
        hwp.HAction.Execute("InsertText", hwp.HParameterSet.HInsertText.HSet)

        hwp.SaveAs(str(output_path.resolve()), SAVE_FORMATS["hwp"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"HWP automation error: {exc}") from exc
    finally:
        if hwp:
            try:
                hwp.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

def _temp_file_response(file_path: Path, temp_dir: Path, **kwargs):
    from starlette.background import BackgroundTask
    import shutil
    return FileResponse(
        path=file_path,
        background=BackgroundTask(_cleanup_temp_dir, temp_dir),
        **kwargs,
    )

def _cleanup_temp_dir(temp_dir: Path):
    import shutil
    try:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception as exc:
        print(f"Failed to clean up temp dir {temp_dir}: {exc}")
