from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import os
import subprocess
import time
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Ang AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://localhost:9090"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ang-ai:latest")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "768"))
ollama_client = ollama.Client(host=OLLAMA_BASE_URL)

OLLAMA_OPTIONS = {
    "temperature": 0.25,
    "top_p": 0.85,
    "top_k": 40,
    "repeat_penalty": 1.08,
    "num_ctx": OLLAMA_NUM_CTX,
    "num_predict": OLLAMA_NUM_PREDICT,
}


class ChatRequest(BaseModel):
    message: str


class ParseRequest(BaseModel):
    file_path: str


class AnalyzeRequest(BaseModel):
    file_path: str
    prompt: str = "다음 문서를 핵심만 한국어로 요약해줘."


@app.get("/health")
def health():
    return {
        "status": "ok",
        "message": "AI server is running!",
        "model": OLLAMA_MODEL,
        "ollama_base_url": OLLAMA_BASE_URL,
        "num_ctx": OLLAMA_NUM_CTX,
        "num_predict": OLLAMA_NUM_PREDICT,
    }


@app.post("/chat")
def chat(req: ChatRequest):
    start = time.monotonic()
    print(f"[chat] start model={OLLAMA_MODEL} prompt_chars={len(req.message)}", flush=True)
    response = ollama_client.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": req.message}],
        options=OLLAMA_OPTIONS,
    )
    elapsed = time.monotonic() - start
    print(f"[chat] done model={OLLAMA_MODEL} elapsed={elapsed:.2f}s", flush=True)
    return {"reply": response["message"]["content"]}


@app.post("/parse-document")
def parse_document(req: ParseRequest):
    parsed = parse_file(req.file_path)

    if not parsed["success"]:
        return parsed

    return parsed


@app.post("/analyze-document")
def analyze_document(req: AnalyzeRequest):
    parsed = parse_file(req.file_path)

    if not parsed["success"]:
        return parsed

    markdown = parsed["markdown"]
    response = ollama_client.chat(
        model=OLLAMA_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"{req.prompt}\n\n--- 문서 내용 ---\n{markdown}"
            }
        ],
        options=OLLAMA_OPTIONS,
    )

    return {
        "success": True,
        "model": OLLAMA_MODEL,
        "markdown": markdown,
        "answer": response["message"]["content"]
    }


def parse_file(file_path: str):
    result = subprocess.run(
        ["npx", "--no-install", "kordoc", file_path],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60
    )

    if result.returncode != 0:
        return {
            "success": False,
            "error": result.stderr
        }

    return {
        "success": True,
        "markdown": result.stdout
    }
