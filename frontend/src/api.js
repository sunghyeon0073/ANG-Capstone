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

// 이벤트 날짜 문자열 → Date 변환
export function parseEvent(e) {
  return { ...e, start: new Date(e.start_date), shared: !!e.shared, ai: !!e.ai };
}
