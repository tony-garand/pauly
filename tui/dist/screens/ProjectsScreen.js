import { jsx as _jsx } from "react/jsx-runtime";
import { useNavigationStack } from "../hooks/useNavigationStack.js";
import { ProjectList } from "./ProjectList.js";
import { ProjectDetail } from "./ProjectDetail.js";
export function ProjectsScreen() {
    const nav = useNavigationStack({ type: "list" });
    if (nav.current.type === "detail") {
        return (_jsx(ProjectDetail, { projectName: nav.current.name, onBack: nav.pop }));
    }
    return (_jsx(ProjectList, { onSelect: (p) => nav.push({ type: "detail", name: p.name }) }));
}
