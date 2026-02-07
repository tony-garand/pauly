import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Layout } from "@/components/Layout";
import { Loading } from "@/components/ui/loading";

// Lazy load all pages for better initial bundle size
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Projects = lazy(() => import("@/pages/Projects").then(m => ({ default: m.Projects })));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail").then(m => ({ default: m.ProjectDetail })));
const Logs = lazy(() => import("@/pages/Logs").then(m => ({ default: m.Logs })));
const CLIs = lazy(() => import("@/pages/CLIs").then(m => ({ default: m.CLIs })));
const Status = lazy(() => import("@/pages/Status").then(m => ({ default: m.Status })));
const Config = lazy(() => import("@/pages/Config").then(m => ({ default: m.Config })));
const Railway = lazy(() => import("@/pages/Railway").then(m => ({ default: m.Railway })));
const DeadLetter = lazy(() => import("@/pages/DeadLetter").then(m => ({ default: m.DeadLetter })));
const Metrics = lazy(() => import("@/pages/Metrics").then(m => ({ default: m.Metrics })));

// Wrapper component for lazy loaded pages
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading message="Loading..." />}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <LazyPage><Dashboard /></LazyPage>,
      },
      {
        path: "projects",
        element: <LazyPage><Projects /></LazyPage>,
      },
      {
        path: "projects/:name",
        element: <LazyPage><ProjectDetail /></LazyPage>,
      },
      {
        path: "logs",
        element: <LazyPage><Logs /></LazyPage>,
      },
      {
        path: "logs/:job",
        element: <LazyPage><Logs /></LazyPage>,
      },
      {
        path: "clis",
        element: <LazyPage><CLIs /></LazyPage>,
      },
      {
        path: "status",
        element: <LazyPage><Status /></LazyPage>,
      },
      {
        path: "config",
        element: <LazyPage><Config /></LazyPage>,
      },
      {
        path: "railway",
        element: <LazyPage><Railway /></LazyPage>,
      },
      {
        path: "deadletter",
        element: <LazyPage><DeadLetter /></LazyPage>,
      },
      {
        path: "metrics",
        element: <LazyPage><Metrics /></LazyPage>,
      },
    ],
  },
]);
