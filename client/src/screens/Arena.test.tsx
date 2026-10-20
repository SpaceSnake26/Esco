import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { Arena } from "./Arena";

const h = vi.hoisted(() => ({
  status: "question" as string,
  answer: vi.fn(),
  start: vi.fn(),
}));

vi.mock("../api", () => ({
  api: { regions: () => Promise.resolve([{ id: 1, order: 1, slug: "medellin", name: "Medellín", theme: "Basics", status: "current" }]) },
}));

vi.mock("../live/useLiveGame", () => ({
  useLiveGame: () => ({
    connected: true,
    status: h.status,
    hostUserId: 1,
    players: [{ userId: 1, name: "Fabio", avatar: "🐆" }],
    question: { t: "question", index: 0, total: 3, questionId: 10, prompt: "How do you say hello?", options: ["Hola", "Adiós", "Gracias", "Por favor"], timeLimitMs: 15000 },
    answeredUserIds: [],
    reveal: null,
    podium: [],
    error: null,
    actions: { enter: vi.fn(), create: vi.fn(), join: vi.fn(), start: h.start, next: vi.fn(), reveal: vi.fn(), answer: h.answer },
  }),
}));

function wrap(ui: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("question: shows four answer buttons and answers with the picked index", () => {
  h.status = "question";
  render(wrap(<Arena user={{ id: 1, name: "Fabio", avatar: "🐆" }} />));
  const buttons = screen.getAllByRole("button", { name: /Option/ });
  expect(buttons).toHaveLength(4);
  fireEvent.click(buttons[2]);
  expect(h.answer).toHaveBeenCalledWith(2);
});

test("lobby: anyone can press Start to begin", () => {
  h.status = "lobby";
  render(wrap(<Arena user={{ id: 1, name: "Fabio", avatar: "🐆" }} />));
  fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
  expect(h.start).toHaveBeenCalled();
});
