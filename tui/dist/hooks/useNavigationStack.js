import { useState, useCallback } from "react";
export function useNavigationStack(initial) {
    const [stack, setStack] = useState([initial]);
    const push = useCallback((view) => {
        setStack((s) => [...s, view]);
    }, []);
    const pop = useCallback(() => {
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    }, []);
    const reset = useCallback(() => {
        setStack([initial]);
    }, [initial]);
    return {
        current: stack[stack.length - 1],
        canGoBack: stack.length > 1,
        push,
        pop,
        reset,
    };
}
