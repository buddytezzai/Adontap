import { auth } from "./firebase";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

export async function apiFetch(path, options = {}) {
  const token = auth ? await auth.currentUser?.getIdToken() : null;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status})`);
  return body;
}
