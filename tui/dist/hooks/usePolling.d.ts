interface UsePollingOptions {
    enabled?: boolean;
    immediate?: boolean;
}
interface UsePollingResult<T> {
    data: T | null;
    error: Error | null;
    loading: boolean;
    refresh: () => void;
}
export declare function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, options?: UsePollingOptions): UsePollingResult<T>;
export {};
