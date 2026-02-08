const API_BASE = "http://localhost:3001/api";
export class ApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}
export async function fetchApi(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
        let msg = `API error: ${response.status}`;
        try {
            const data = await response.json();
            if (data.error)
                msg = data.error;
        }
        catch { }
        throw new ApiError(msg, response.status);
    }
    return response.json();
}
export async function postApi(endpoint, body) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        let msg = `API error: ${response.status}`;
        try {
            const data = await response.json();
            if (data.error)
                msg = data.error;
        }
        catch { }
        throw new ApiError(msg, response.status);
    }
    return response.json();
}
export async function patchApi(endpoint, body) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "PATCH",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        let msg = `API error: ${response.status}`;
        try {
            const data = await response.json();
            if (data.error)
                msg = data.error;
        }
        catch { }
        throw new ApiError(msg, response.status);
    }
    return response.json();
}
export async function deleteApi(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        let msg = `API error: ${response.status}`;
        try {
            const data = await response.json();
            if (data.error)
                msg = data.error;
        }
        catch { }
        throw new ApiError(msg, response.status);
    }
    return response.json();
}
