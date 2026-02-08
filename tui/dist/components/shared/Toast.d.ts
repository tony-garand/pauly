interface ToastMessage {
    id: number;
    text: string;
    type: "info" | "success" | "error";
}
export declare function showToast(text: string, type?: ToastMessage["type"]): void;
export declare function ToastContainer(): import("react/jsx-runtime").JSX.Element | null;
export {};
