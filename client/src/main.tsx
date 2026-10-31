import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { RequireAuth } from "./auth";
import { Arena } from "./screens/Arena";
import { Charlar } from "./screens/Charlar";
import { Home } from "./screens/Home";
import { Homework } from "./screens/Homework";
import { Leaderboard } from "./screens/Leaderboard";
import { Logros } from "./screens/Logros";
import { Misiones } from "./screens/Misiones";
import { Pronunciation } from "./screens/Pronunciation";
import { Ruta } from "./screens/Ruta";
import { School } from "./screens/School";
import { Stop } from "./screens/Stop";

// A new deploy's service worker takes over in the background: reload once so nobody
// keeps playing on a stale cached build. No reload on the very first install.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}

const qc = new QueryClient();
const router = createBrowserRouter([
  { path: "/", element: <RequireAuth>{(user) => <Home user={user} />}</RequireAuth> },
  { path: "/ruta", element: <RequireAuth>{() => <Ruta />}</RequireAuth> },
  { path: "/tarea", element: <RequireAuth>{() => <Homework />}</RequireAuth> },
  { path: "/ranking", element: <RequireAuth>{() => <Leaderboard />}</RequireAuth> },
  { path: "/logros", element: <RequireAuth>{() => <Logros />}</RequireAuth> },
  { path: "/misiones", element: <RequireAuth>{() => <Misiones />}</RequireAuth> },
  { path: "/charlar", element: <RequireAuth>{(user) => <Charlar user={user} />}</RequireAuth> },
  { path: "/escuchar", element: <RequireAuth>{() => <Pronunciation />}</RequireAuth> },
  { path: "/stop/:id", element: <RequireAuth>{() => <Stop />}</RequireAuth> },
  { path: "/clase", element: <RequireAuth>{(user) => <School user={user} />}</RequireAuth> },
  { path: "/arena", element: <RequireAuth>{(user) => <Arena user={user} />}</RequireAuth> },
  { path: "/arena/host", element: <Navigate to="/arena" replace /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
