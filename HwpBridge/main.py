import json
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

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

    with tempfile.TemporaryDirectory(prefix="ang-hwp-") as temp_dir:
        temp_path = Path(temp_dir)
        original_name = Path(file.filename or "document.hwp").name
        input_path = temp_path / f"{uuid.uuid4()}-{original_name}"
        output_path = temp_path / f"{input_path.stem}-edited.{output_format}"

        input_path.write_bytes(await file.read())
        _replace_with_hwp(input_path, output_path, replacement_items, output_format)

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="HWP save completed but output file was not created")

        download_name = f"{Path(original_name).stem}-edited.{output_format}"
        return FileResponse(
            output_path,
            media_type=CONTENT_TYPES[output_format],
            filename=download_name,
        )


@app.post("/hwp/preview-pdf")
async def preview_hwp_pdf(file: UploadFile = File(...)):
    with tempfile.TemporaryDirectory(prefix="ang-hwp-preview-") as temp_dir:
        temp_path = Path(temp_dir)
        original_name = Path(file.filename or "document.hwp").name
        input_path = temp_path / f"{uuid.uuid4()}-{original_name}"
        output_path = temp_path / f"{input_path.stem}-preview.pdf"

        input_path.write_bytes(await file.read())
        _save_with_hwp(input_path, output_path, "pdf")

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="HWP preview PDF was not created")

        download_name = f"{Path(original_name).stem}-preview.pdf"
        return FileResponse(
            output_path,
            media_type=CONTENT_TYPES["pdf"],
            filename=download_name,
        )


def _replace_with_hwp(input_path: Path, output_path: Path, replacements: list, output_format: str) -> None:
    def apply_replacements(hwp):
        for item in replacements:
            find_text = str(item.get("find", "") if isinstance(item, dict) else "").strip()
            replace_text = str(item.get("replace", "") if isinstance(item, dict) else "")
            if not find_text:
                continue
            _all_replace(hwp, find_text, replace_text)

    _save_with_hwp(input_path, output_path, output_format, apply_replacements)


def _save_with_hwp(input_path: Path, output_path: Path, output_format: str, before_save=None) -> None:
    if pythoncom is None or win32com is None:
        raise HTTPException(status_code=500, detail="pywin32 is required on a Windows host")

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
