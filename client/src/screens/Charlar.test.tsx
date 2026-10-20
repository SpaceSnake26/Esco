import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import { Charlar } from "./Charlar";

const pablito = vi.fn();
const completeQuest = vi.fn();

vi.mock("../api", () => ({
  api: {
    pablito: (...args: unknown[]) => pablito(...args),
    completeQuest: (...args: unknown[]) => completeQuest(...args),
  },
}));

const user = { id: 1, name: "Fabio", avatar: "🧑" };

function wrap(ui: ReactNode, route = "/charlar") {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  pablito.mockReset();
  completeQuest.mockReset();
});

test("sending a message renders Pablito's reply", async () => {
  pablito.mockResolvedValueOnce({ reply: "¡Hola, parcero!" });
  render(wrap(<Charlar user={user} />));

  fireEvent.change(screen.getByLabelText("Message for Pablito"), { target: { value: "hola" } });
  fireEvent.click(screen.getByText("Send"));

  expect(await screen.findByText(/¡Hola, parcero!/)).toBeInTheDocument();
  await waitFor(() => expect(pablito).toHaveBeenCalledWith([{ role: "user", content: "hola" }], undefined));
});

test("a degraded reply is shown with the offline practice-mode note", async () => {
  pablito.mockResolvedValueOnce({ reply: "¡Sigue en español! 🦜", degraded: true });
  render(wrap(<Charlar user={user} />));

  fireEvent.change(screen.getByLabelText("Message for Pablito"), { target: { value: "hola" } });
  fireEvent.click(screen.getByText("Send"));

  // The reply still appears (chat never dead-ends) plus a clear offline note.
  expect(await screen.findByText(/¡Sigue en español!/)).toBeInTheDocument();
  expect(await screen.findByText(/offline \(practice mode\)/)).toBeInTheDocument();
});

test("roleplay mode: after 3 user messages the claim button completes the quest", async () => {
  pablito.mockResolvedValue({ reply: "ok" });
  completeQuest.mockResolvedValueOnce({ awarded: 30, multiplier: 1 });
  render(wrap(<Charlar user={user} />, "/charlar?scenario=pide%20un%20tinto&quest=42"));

  const box = screen.getByLabelText("Message for Pablito");
  for (let i = 0; i < 3; i++) {
    fireEvent.change(box, { target: { value: `msg ${i}` } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(pablito).toHaveBeenCalledTimes(i + 1));
  }

  const claimBtn = await screen.findByText("Finish & claim (+30)");
  fireEvent.click(claimBtn);

  await waitFor(() => expect(completeQuest).toHaveBeenCalledWith(42));
  expect(await screen.findByText(/\+30/)).toBeInTheDocument();
});
