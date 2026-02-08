import type { LogInfo } from "../api/types.js";
interface LogListProps {
    onSelect: (log: LogInfo) => void;
}
export declare function LogList({ onSelect }: LogListProps): import("react/jsx-runtime").JSX.Element;
export {};
