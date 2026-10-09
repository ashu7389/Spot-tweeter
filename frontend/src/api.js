const BASE = "/api";

function getToken() {
  return localStorage.getItem("pulse_token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g. a proxy/HTML error page) — surface a
      // generic message instead of throwing on JSON.parse.
      data = { error: "Unexpected server response" };
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  signup: (payload) => request("/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  getFeed: (cursor) => request(`/posts${cursor ? `?cursor=${cursor}` : ""}`),
  createPost: (formData) => request("/posts", { method: "POST", body: formData, isForm: true }),
  toggleLike: (id) => request(`/posts/${id}/like`, { method: "POST" }),
  deletePost: (id) => request(`/posts/${id}`, { method: "DELETE" }),
  getProfile: (handle, cursor) =>
    request(`/users/${handle}${cursor ? `?cursor=${cursor}` : ""}`),
  updateProfile: (formData) =>
    request("/users/me", { method: "PATCH", body: formData, isForm: true }),
  writeRecommendation: (handle, text) =>
    request(`/users/${handle}/recommendations`, { method: "POST", body: { text } }),
  setToken: (token) => localStorage.setItem("pulse_token", token),
  clearToken: () => localStorage.removeItem("pulse_token"),
  getToken,
};
