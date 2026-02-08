import { type ScreenTab } from "../context/KeyboardContext.js";
interface CommandBarProps {
    onNavigate: (tab: ScreenTab) => void;
    onExit: () => void;
}
export declare function CommandBar({ onNavigate, onExit }: CommandBarProps): import("react/jsx-runtime").JSX.Element | null;
export {};
