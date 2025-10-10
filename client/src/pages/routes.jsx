// --- REPLACE START: lazy routes example ---
import { lazy, Suspense } from "react";
const DiscoverPage = lazy(() => import("./DiscoverPage.jsx"));
const ChatPage = lazy(() => import("./ChatPage.jsx"));
const ProfilePage = lazy(() => import("./ProfilePage.jsx"));

export const routes = [
  { path: "/", element: <HomePage/> },
  {
    path: "/discover",
    element: <Suspense fallback={<div className="p-8">Loading…</div>}><DiscoverPage/></Suspense>
  },
  {
    path: "/chat",
    element: <Suspense fallback={<div className="p-8">Loading…</div>}><ChatPage/></Suspense>
  },
  {
    path: "/profile",
    element: <Suspense fallback={<div className="p-8">Loading…</div>}><ProfilePage/></Suspense>
  },
];
// --- REPLACE END ---
