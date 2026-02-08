const API_BASE = "http://localhost:3001/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    let msg = `API error: ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) msg = data.error;
    } catch {}
    throw new ApiError(msg, response.status);
  }
  return response.json() as Promise<T>;
}

export async function postApi<T>(
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let msg = `API error: ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) msg = data.error;
    } catch {}
    throw new ApiError(msg, response.status);
  }
  return response.json() as Promise<T>;
}

export async function patchApi<T>(
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "PATCH",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let msg = `API error: ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) msg = data.error;
    } catch {}
    throw new ApiError(msg, response.status);
  }
  return response.json() as Promise<T>;
}

export async function deleteApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    let msg = `API error: ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) msg = data.error;
    } catch {}
    throw new ApiError(msg, response.status);
  }
  return response.json() as Promise<T>;
}
