from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "ang-ai"

# ✅ 요청 데이터 구조
class ChatRequest(BaseModel):
    message: str

@app.get("/ai/health")
def ai_health():
    return {"status": "ok", "model": MODEL_NAME}

@app.post("/ai/chat")
def ai_chat(req: ChatRequest):
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": req.message,
                "stream": False
            },
            timeout=120
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama 서버 호출에 실패했습니다: {exc}"
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Ollama 응답을 JSON으로 읽을 수 없습니다."
        ) from exc

    return {
        "answer": data.get("response", "")
    }
