from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Ang AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://localhost:9090"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


class ChatRequest(BaseModel):
    message: str


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
