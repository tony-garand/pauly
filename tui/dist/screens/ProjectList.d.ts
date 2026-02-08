import type { ProjectInfo } from "../api/types.js";
interface ProjectListProps {
    onSelect: (project: ProjectInfo) => void;
}
export declare function ProjectList({ onSelect }: ProjectListProps): import("react/jsx-runtime").JSX.Element;
export {};
