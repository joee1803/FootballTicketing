export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
}

export async function apiFetch(path, options = {}) {
  const token = options.token;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...options,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed with status ${response.status}`;
    let parsed = null;

    if (text) {
      try {
        parsed = JSON.parse(text);
        if (parsed?.error) {
          message = parsed.error;
        }
      } catch {
        message = text;
      }
    }

    const error = new Error(message);
    error.status = response.status;
    error.data = parsed;
    throw error;
  }

  return response.json();
}
