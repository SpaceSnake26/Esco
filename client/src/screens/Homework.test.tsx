import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { Homework } from "./Homework";

vi.mock("../api", () => ({
  api: {
    regions: () => Promise.resolve([{ id: 1, order: 1, slug: "medellin", name: "Medellín", theme: "Saludos", status: "current" }]),
    region: () => Promise.resolve({ lessons: [{ id: 2, kind: "homework", title: "Tarea", body: null, exercises: [
      { id: 10, type: "multiple_choice", prompt: "'Thank you'?", options: ["Hola", "Gracias"], points: 10, done: false, gotCorrect: false },
    ] }] }),
    attempt: vi.fn(() => Promise.resolve({ correct: true, awarded: 10, correctAnswer: "Gracias" })),
  },
}));

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("answering a multiple-choice question shows a correct result", async () => {
  render(wrap(<Homework />));
  fireEvent.click(await screen.findByText("Gracias"));
  expect(await screen.findByText(/\+10/)).toBeInTheDocument();
});
