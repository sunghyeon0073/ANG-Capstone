from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import os
import subprocess
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Ang AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://localhost:9090"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")


class ChatRequest(BaseModel):
    message: str


class ParseRequest(BaseModel):
    file_path: str


@app.get("/health")
def health():
    return {"status": "ok", "message": "AI server is running!"}


@app.post("/chat")
def chat(req: ChatRequest):
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": req.message}]
    )
    return {"reply": response["message"]["content"]}


@app.post("/parse-document")
def parse_document(req: ParseRequest):
    result = subprocess.run(
        ["npx", "--no-install", "kordoc", req.file_path],
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
