import { useState, useEffect, useCallback, useRef } from "react";
export function usePolling(fetcher, intervalMs, options = {}) {
    const { enabled = true, immediate = true } = options;
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const doFetch = useCallback(async () => {
        try {
            const result = await fetcherRef.current();
            setData(result);
            setError(null);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (!enabled)
            return;
        if (immediate)
            doFetch();
        const id = setInterval(doFetch, intervalMs);
        return () => clearInterval(id);
    }, [enabled, intervalMs, immediate, doFetch]);
    return { data, error, loading, refresh: doFetch };
}
