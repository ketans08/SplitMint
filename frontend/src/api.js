const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:4000" : "");

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export const authApi = {
  register: (payload) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(payload) })
};

export const groupApi = {
  list: () => apiRequest("/api/groups"),
  create: (payload) => apiRequest("/api/groups", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/api/groups/${id}`, { method: "DELETE" }),
  get: (id) => apiRequest(`/api/groups/${id}`)
};

export const participantApi = {
  create: (payload) => apiRequest("/api/participants", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/api/participants/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/api/participants/${id}`, { method: "DELETE" })
};

export const expenseApi = {
  list: (params) => {
    const q = new URLSearchParams(params);
    return apiRequest(`/api/expenses?${q.toString()}`);
  },
  create: (payload) => apiRequest("/api/expenses", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/api/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/api/expenses/${id}`, { method: "DELETE" })
};

export const inviteApi = {
  accept: (payload) => apiRequest("/api/invites/accept", { method: "POST", body: JSON.stringify(payload) })
};
