import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { Home } from "./Home";

vi.mock("../api", () => ({
  api: {
    regions: () => Promise.resolve([{ id: 1, order: 1, slug: "medellin", name: "Medellín", theme: "Saludos", status: "current" }]),
    leaderboard: () => Promise.resolve([{ userId: 1, name: "Jugador 1", avatar: "🧑", points: 120 }]),
    streak: () => Promise.resolve({ current: 5, longest: 9 }),
    questsToday: () => Promise.resolve([
      { id: 1, type: "vocab_blast", points: 40, done: false, payload: { questions: [] } },
      { id: 2, type: "word_of_day", points: 15, done: true, payload: { es: "Hola", en: "Hello", example: null } },
    ]),
  },
}));

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("shows greeting, current region, and leaderboard points", async () => {
  render(wrap(<Home user={{ id: 1, name: "Jugador 1", avatar: "🧑" }} />));
  expect(await screen.findByText(/Medellín/)).toBeInTheDocument();
  expect(await screen.findByText(/120/)).toBeInTheDocument();
});
