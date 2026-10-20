import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { Logros } from "./Logros";

vi.mock("../api", () => ({
  api: {
    badges: () => Promise.resolve([
      { code: "primera_tarea", name: "Primera tarea", emoji: "📘", description: "first correct homework exercise", earned: true, earnedAt: 1700000000000 },
      { code: "racha_7", name: "Racha de 7", emoji: "🔥", description: "streak reached 7 days", earned: false, earnedAt: null },
    ]),
  },
}));

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("renders an earned badge in color and a locked badge with a lock", async () => {
  render(wrap(<Logros />));

  // Earned badge shows its name and emoji.
  const earned = await screen.findByLabelText(/Primera tarea \(earned\)/);
  expect(earned).toBeInTheDocument();
  expect(earned).toHaveTextContent("📘");

  // Locked badge shows its name but a lock instead of its emoji.
  const locked = screen.getByLabelText(/Racha de 7 \(locked\)/);
  expect(locked).toBeInTheDocument();
  expect(locked).toHaveTextContent("🔒");
});
