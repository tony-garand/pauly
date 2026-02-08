import type { ScreenTab } from "../context/KeyboardContext.js";
export interface CommandResult {
    output: string;
    error?: boolean;
    navigate?: ScreenTab;
}
type StreamCallback = (chunk: string) => void;
export declare function executeCommand(raw: string, onStream: StreamCallback): Promise<CommandResult>;
export {};
