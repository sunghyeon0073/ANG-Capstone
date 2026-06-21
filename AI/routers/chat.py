import os
from collections.abc import Mapping
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import ollama

router = APIRouter()

import json
from typing import List, Dict, Any

class ChatRequest(BaseModel):
    message: str

class FormField(BaseModel):
    id: str
    label: str

class ExtractFormRequest(BaseModel):
    memo: str
    fields: List[FormField]

@router.post("/chat")
def chat(req: ChatRequest):
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    is_mock = os.getenv("OLLAMA_MOCK", "false").lower() == "true"
    if is_mock:
        print("[chat] Running in MOCK mode. Bypassing Ollama.", flush=True)
        return {"reply": "[Local Mock Mode] 이것은 Ollama 연결 없이 로컬에서 생성된 가짜 응답입니다.\n질문: " + message}

    model = os.getenv("OLLAMA_MODEL", "ang-ai:latest")
    
    # Priority: 1. Env Var, 2. Docker detection, 3. localhost
    env_url = os.getenv("OLLAMA_BASE_URL")
    is_docker = os.path.exists("/.dockerenv") or os.getenv("DOCKER_CONTAINER") == "true"
    
    urls_to_try = []
    if env_url:
        urls_to_try.append(env_url)
    
    if is_docker:
        if "http://host.docker.internal:11434" not in urls_to_try:
            urls_to_try.append("http://host.docker.internal:11434")
    
    if "http://localhost:11434" not in urls_to_try:
        urls_to_try.append("http://localhost:11434")

    last_exc = None
    successful_url = None
    response = None

    for base_url in urls_to_try:
        try:
            client = ollama.Client(host=base_url)
            response = client.chat(
                model=model,
                messages=[{"role": "user", "content": message}],
            )
            successful_url = base_url
            break
        except Exception as exc:
            print(f"[chat] Failed to connect to Ollama at {base_url}: {exc}")
            last_exc = exc

    if not response:
        error_msg = (
            f"Ollama request failed. Tried URLs: {urls_to_try}. "
            "Make sure Ollama is running on your HOST machine. "
            "If using Docker, ensure OLLAMA_HOST is set to 0.0.0.0 on the host. "
            f"Last error: {last_exc}"
        )
        raise HTTPException(status_code=502, detail=error_msg)

    print(f"[chat] Successfully connected to Ollama at {successful_url}")

    reply = _extract_ollama_reply(response)
    if not reply.strip():
        raise HTTPException(status_code=502, detail="Ollama returned an empty reply")

    return {"reply": reply}

def _extract_ollama_reply(response) -> str:
    if hasattr(response, "model_dump"):
        response = response.model_dump()

    if isinstance(response, Mapping):
        message = response.get("message") or {}
        if hasattr(message, "model_dump"):
            message = message.model_dump()
        if isinstance(message, Mapping):
            return str(message.get("content") or "")
        return str(getattr(message, "content", "") or "")

    message = getattr(response, "message", None)
    if hasattr(message, "model_dump"):
        message = message.model_dump()
    if isinstance(message, Mapping):
        return str(message.get("content") or "")
    return str(getattr(message, "content", "") or "")

@router.post("/extract-form")
def extract_form(req: ExtractFormRequest):
    memo = (req.memo or "").strip()
    if not memo:
        raise HTTPException(status_code=400, detail="memo is required")

    is_mock = os.getenv("OLLAMA_MOCK", "false").lower() == "true"
    if is_mock:
        print("[chat] Running in MOCK mode for extract-form. Rule-based matching.", flush=True)
        fake_data = {}
        lines = [line.strip() for line in memo.split('\n') if line.strip()]
        
        for f in req.fields:
            matched_val = ""
            for line in lines:
                if f.label.lower() in line.lower() or f.id.lower() in line.lower():
                    # Extract everything after the label if there's a colon or space
                    import re
                    # e.g., "회의일시: 2026-06-25" -> "2026-06-25"
                    val = re.sub(f"^{f.label}[:\\s]*|^{f.id}[:\\s]*", "", line, flags=re.IGNORECASE).strip()
                    if val:
                        matched_val = val
                        break
            fake_data[f.id] = matched_val if matched_val else f"AI가 자동 추출한 {f.label} 내용입니다."
            
        return {"data": fake_data}

    model = os.getenv("OLLAMA_MODEL", "ang-ai:latest")
    env_url = os.getenv("OLLAMA_BASE_URL")
    is_docker = os.path.exists("/.dockerenv") or os.getenv("DOCKER_CONTAINER") == "true"
    
    urls_to_try = []
    if env_url: urls_to_try.append(env_url)
    if is_docker and "http://host.docker.internal:11434" not in urls_to_try:
        urls_to_try.append("http://host.docker.internal:11434")
    if "http://localhost:11434" not in urls_to_try:
        urls_to_try.append("http://localhost:11434")

    prompt = f"다음 메모를 읽고, 아래 요청된 항목들을 추출해서 JSON 형태로 반환해줘.\n\n[메모]\n{memo}\n\n[요청 항목]\n"
    for f in req.fields:
        prompt += f"- {f.label} (JSON key: {f.id})\n"
    prompt += "\n응답은 반드시 중괄호로 시작하고 끝나는 순수 JSON 문자열만 출력해. 마크다운 태그(```json)나 다른 설명은 절대 추가하지 마."

    last_exc = None
    successful_url = None
    response = None

    for base_url in urls_to_try:
        try:
            client = ollama.Client(host=base_url)
            response = client.chat(
                model=model,
                messages=[{"role": "user", "content": prompt}],
            )
            successful_url = base_url
            break
        except Exception as exc:
            last_exc = exc

    if not response:
        raise HTTPException(status_code=502, detail=f"Ollama request failed. Last error: {last_exc}")

    reply = _extract_ollama_reply(response)
    
    # Clean markdown if ollama returns it
    if reply.startswith("```json"):
        reply = reply[7:]
    if reply.startswith("```"):
        reply = reply[3:]
    if reply.endswith("```"):
        reply = reply[:-3]
    
    reply = reply.strip()
    
    try:
        parsed_data = json.loads(reply)
        return {"data": parsed_data}
    except json.JSONDecodeError:
        print("[chat] JSON Decode Error from Ollama reply:", reply)
        raise HTTPException(status_code=500, detail="Ollama returned invalid JSON.")
