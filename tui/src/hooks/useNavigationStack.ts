import { useState, useCallback } from "react";

export interface NavigationStack<T = string> {
  current: T;
  canGoBack: boolean;
  push: (view: T) => void;
  pop: () => void;
  reset: () => void;
}

export function useNavigationStack<T = string>(
  initial: T,
): NavigationStack<T> {
  const [stack, setStack] = useState<T[]>([initial]);

  const push = useCallback((view: T) => {
    setStack((s) => [...s, view]);
  }, []);

  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const reset = useCallback(() => {
    setStack([initial]);
  }, [initial]);

  return {
    current: stack[stack.length - 1]!,
    canGoBack: stack.length > 1,
    push,
    pop,
    reset,
  };
}
