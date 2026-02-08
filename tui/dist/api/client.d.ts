export declare class ApiError extends Error {
    status: number;
    constructor(message: string, status: number);
}
export declare function fetchApi<T>(endpoint: string): Promise<T>;
export declare function postApi<T>(endpoint: string, body?: unknown): Promise<T>;
export declare function patchApi<T>(endpoint: string, body?: unknown): Promise<T>;
export declare function deleteApi<T>(endpoint: string): Promise<T>;
