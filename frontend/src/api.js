const BASE = '/api';

async function req(method, path, body) {
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch {
    return null;
  }
}

export const api = {
  get:    (path)        => req('GET',    path),
  post:   (path, body)  => req('POST',   path, body),
  patch:  (path, body)  => req('PATCH',  path, body),
  delete: (path)        => req('DELETE', path),
};

const AI_ENDPOINTS = [
  '/ai/chat',
  'http://127.0.0.1:8001/ai/chat',
  'http://127.0.0.1:8000/ai/chat',
];

export async function askAI(message) {
  let lastError = null;

  for (const endpoint of AI_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`AI 요청 실패 (${res.status}) ${detail}`);
      }

      const data = await res.json();
      return data.answer;
    } catch (err) {
      lastError = err;
      console.warn(`AI endpoint failed: ${endpoint}`, err);
    }
  }

  throw lastError || new Error('AI 서버에 연결할 수 없습니다.');
}

// 이벤트 날짜 문자열 → Date 변환
export function parseEvent(e) {
  return { ...e, start: new Date(e.start_date), shared: !!e.shared, ai: !!e.ai };
}
