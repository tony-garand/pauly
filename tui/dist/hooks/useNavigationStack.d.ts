export interface NavigationStack<T = string> {
    current: T;
    canGoBack: boolean;
    push: (view: T) => void;
    pop: () => void;
    reset: () => void;
}
export declare function useNavigationStack<T = string>(initial: T): NavigationStack<T>;
