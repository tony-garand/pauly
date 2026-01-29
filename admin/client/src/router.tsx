import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Projects } from "@/pages/Projects";
import { ProjectDetail } from "@/pages/ProjectDetail";
import { Logs } from "@/pages/Logs";
import { CLIs } from "@/pages/CLIs";
import { Status } from "@/pages/Status";
import { Config } from "@/pages/Config";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "projects",
        element: <Projects />,
      },
      {
        path: "projects/:name",
        element: <ProjectDetail />,
      },
      {
        path: "logs",
        element: <Logs />,
      },
      {
        path: "logs/:job",
        element: <Logs />,
      },
      {
        path: "clis",
        element: <CLIs />,
      },
      {
        path: "status",
        element: <Status />,
      },
      {
        path: "config",
        element: <Config />,
      },
    ],
  },
]);
