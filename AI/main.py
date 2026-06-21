from fastapi import FastAPI
from routers import chat, hwp, docx, excel

try:
    import pythoncom
    import win32com.client
except ImportError:
    pythoncom = None
    win32com = None

app = FastAPI(title="ANG AI Bridge")

app.include_router(chat.router)
app.include_router(hwp.router)
app.include_router(docx.router)
app.include_router(excel.router)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "hwp_status": "ok" if pythoncom and win32com else "missing-pywin32",
        "message": "ANG AI bridge is running",
    }
