import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { PublicUser } from "@shared/types";
import { Login } from "./screens/Login";

/**
 * Gate children behind authentication. Backed by react-query (key ["me"]) so the
 * session is fetched once and cached — navigating between tabs reuses the cache
 * instead of re-fetching and flashing the loading state on every route change.
 */
export function RequireAuth({ children }: { children: (user: PublicUser) => React.ReactNode }) {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
    staleTime: Infinity,
  });

  if (isLoading) return <main style={{ padding: 24 }}>…</main>;
  if (!user) return <Login onLoggedIn={(u) => qc.setQueryData(["me"], u)} />;
  return <>{children(user)}</>;
}
