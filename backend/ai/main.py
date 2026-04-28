from fastapi import FastAPI
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

OLLAMA_URL = "http://host.docker.internal:11434/api/generate"
MODEL_NAME = "ang-ai"

@app.post("/ai/chat")
def ai_chat(req: ChatRequest):

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "prompt": req.message,
            "stream": False
        }
    )

    data = response.json()

    return {
        "answer": data.get("response", "")
    }