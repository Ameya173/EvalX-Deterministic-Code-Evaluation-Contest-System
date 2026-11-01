const API_BASE = import.meta.env.VITE_API_URL || '';
let accessToken = null;
let sessionHandler = () => {};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const setSessionHandler = (fn) => {
  sessionHandler = fn;
};
export const getToken = () => accessToken;

async function request(path, { method = 'GET', body, retry = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const session = await refreshSession();
    if (session) return request(path, { method, body, retry: false });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || res.statusText, res.status, data.details);
  return data;
}

function setSession(data) {
  accessToken = data ? data.accessToken : null;
  sessionHandler(data ? data.user : null, accessToken);
  return data;
}

export async function refreshSession() {
  try {
    return setSession(await request('/auth/refresh', { method: 'POST', retry: false }));
  } catch {
    setSession(null);
    return null;
  }
}

export const api = {
  login: async (login, password) => setSession(await request('/auth/login', { method: 'POST', body: { login, password } })),
  register: async (handle, email, password) => setSession(await request('/auth/register', { method: 'POST', body: { handle, email, password } })),
  logout: async () => {
    await request('/auth/logout', { method: 'POST', retry: false }).catch(() => {});
    setSession(null);
  },
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body }),
};
