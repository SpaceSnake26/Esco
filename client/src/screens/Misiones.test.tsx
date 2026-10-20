import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { Misiones } from "./Misiones";

const completeQuest = vi.fn((_id: number, _answers?: number[]) =>
  Promise.resolve({ awarded: 40, multiplier: 1, results: [{ correct: true, answerIndex: 0 }] }));

vi.mock("../api", () => ({
  api: {
    questsToday: () => Promise.resolve([
      {
        id: 10, type: "vocab_blast", points: 40, done: false,
        payload: { questions: [{ prompt: '¿Cómo se dice "Hello"?', options: ["Hola", "Gracias", "Adiós", "Chao"] }] },
      },
      {
        id: 11, type: "word_of_day", points: 15, done: false,
        payload: { es: "Buenas", en: "Good day", example: "¡Buenas, parcero!" },
      },
    ]),
    completeQuest: (id: number, answers?: number[]) => completeQuest(id, answers),
  },
}));

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("renders a vocab_blast question and the word of the day", async () => {
  render(wrap(<Misiones />));
  expect(await screen.findByText(/¿Cómo se dice "Hello"\?/)).toBeInTheDocument();
  expect(screen.getByText("⚡ Vocab Blast · 40 pts")).toBeInTheDocument();
  // word-of-day renders its word + example.
  expect(screen.getByText("Buenas")).toBeInTheDocument();
  expect(screen.getByText(/Good day/)).toBeInTheDocument();
  expect(screen.getByText(/¡Buenas, parcero!/)).toBeInTheDocument();
});

test("selecting an option and submitting calls completeQuest with the picks", async () => {
  render(wrap(<Misiones />));
  const option = await screen.findByText("Hola");
  fireEvent.click(option);
  fireEvent.click(screen.getByText("Submit answers"));

  await waitFor(() => expect(completeQuest).toHaveBeenCalledWith(10, [0]));
  expect(await screen.findByText("+40 ⚡")).toBeInTheDocument();
});

test("word-of-day ¡Aprendida! button completes the quest", async () => {
  completeQuest.mockResolvedValueOnce({ awarded: 15, multiplier: 1 } as any);
  render(wrap(<Misiones />));
  const learn = await screen.findByText("Learned! (+15)");
  fireEvent.click(learn);
  await waitFor(() => expect(completeQuest).toHaveBeenCalledWith(11, undefined));
});
