import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { School } from "./School";

vi.mock("../api", () => ({
  api: {
    school: () => Promise.resolve({ regionName: "Medellín", sessions: [
      { id: 1, order: 1, agenda: [{ minutes: 10, title: "Calentamiento", instructions: "Review vocab out loud." }] },
    ] }),
    completeSchool: vi.fn(() => Promise.resolve({ awarded: [{ userId: 1, points: 100 }] })),
  },
}));

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("shows the first agenda step for the session's region", async () => {
  render(wrap(<School user={{ id: 1, name: "Jugador 1", avatar: "🧑" }} />));
  expect(await screen.findByText("Calentamiento")).toBeInTheDocument();
  expect(screen.getByText(/Medellín/)).toBeInTheDocument();
});
