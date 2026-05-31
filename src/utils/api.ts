/** In dev, default to same-origin so Vite proxies /api → backend (avoids CORS). */
export const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? '' : 'http://localhost:3000');

export async function parseJsonResponse<T = Record<string, unknown>>(
  response: Response
): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? 'Invalid response from server'
        : `Server error (${response.status}). Is the backend running on port 3000?`
    );
  }
}

export const apiFetch = (path: string, opts?: RequestInit): Promise<Response> =>
  authFetch(path, opts);

/** Returns Authorization header from sessionStorage token, if present */
export const authHeaders = (): Record<string, string> => {
  const stored = sessionStorage.getItem('health_app_user');
  if (!stored) return { 'Content-Type': 'application/json' };
  try {
    const user = JSON.parse(stored);
    return user?.token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }
      : { 'Content-Type': 'application/json' };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

/** Authenticated fetch — merges JWT from session into every request */
export async function authFetch(
  path: string,
  opts: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(authHeaders());
  if (opts.headers) {
    new Headers(opts.headers).forEach((value, key) => headers.set(key, value));
  }
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}
