import React from "react";
import { useNavigationStack } from "../hooks/useNavigationStack.js";
import { ProjectList } from "./ProjectList.js";
import { ProjectDetail } from "./ProjectDetail.js";
import type { ProjectInfo } from "../api/types.js";

type ProjectView = { type: "list" } | { type: "detail"; name: string };

export function ProjectsScreen() {
  const nav = useNavigationStack<ProjectView>({ type: "list" });

  if (nav.current.type === "detail") {
    return (
      <ProjectDetail
        projectName={nav.current.name}
        onBack={nav.pop}
      />
    );
  }

  return (
    <ProjectList
      onSelect={(p: ProjectInfo) => nav.push({ type: "detail", name: p.name })}
    />
  );
}
