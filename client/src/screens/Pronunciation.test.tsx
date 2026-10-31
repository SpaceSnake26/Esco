import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, expect, test, vi } from "vitest";

// Stub the Web Speech API (jsdom has none) so the screen renders its full UI.
const speakSpy = vi.fn();
beforeAll(() => {
  // Server audio "fails" here, exercising the device-voice fallback.
  window.HTMLMediaElement.prototype.play = () => Promise.reject(new Error("no audio"));
  window.HTMLMediaElement.prototype.pause = () => {};
  class U {
    text: string; voice: unknown = null; lang = ""; rate = 1; pitch = 1;
    onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(t: string) { this.text = t; }
  }
  (globalThis as any).SpeechSynthesisUtterance = U;
  (window as any).speechSynthesis = {
    getVoices: () => [{ name: "Mónica", lang: "es-ES" }, { name: "Jorge", lang: "es-MX" }],
    speak: (u: any) => { speakSpy(u.text); u.onstart?.(); },
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
});

vi.mock("../api", () => ({
  api: {
    regions: () => Promise.resolve([
      { id: 1, order: 1, slug: "medellin", name: "Medellín", theme: "Saludos", status: "current" },
      { id: 2, order: 2, slug: "cartagena", name: "Cartagena", theme: "Comida", status: "locked" },
    ]),
    vocab: (_id: number) => Promise.resolve([
      { es: "Hola", en: "Hello", example: "¡Hola, parcero!" },
      { es: "Gracias", en: "Thank you", example: null },
    ]),
  },
}));

import { Pronunciation } from "./Pronunciation";

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("lists the current region's vocab with play buttons", async () => {
  render(wrap(<Pronunciation />));
  expect(await screen.findByText("Hola")).toBeInTheDocument();
  expect(screen.getByText("Gracias")).toBeInTheDocument();
  expect(screen.getByLabelText("Play Hola")).toBeInTheDocument();
});

test("tapping a word's play button speaks the Spanish", async () => {
  render(wrap(<Pronunciation />));
  fireEvent.click(await screen.findByLabelText("Play Gracias"));
  await waitFor(() => expect(speakSpy).toHaveBeenCalledWith("Gracias"));
});

test("has a male/female voice toggle", async () => {
  render(wrap(<Pronunciation />));
  expect(await screen.findByText("🚺 Female")).toBeInTheDocument();
  expect(screen.getByText("🚹 Male")).toBeInTheDocument();
});

test("female uses the female voice, male uses the male voice (not swapped)", async () => {
  const picked: string[] = [];
  (window as any).speechSynthesis.speak = (u: any) => {
    picked.push(u.voice?.name ?? "none");
    u.onstart?.();
  };
  render(wrap(<Pronunciation />));
  // Default is female → Mónica.
  fireEvent.click(await screen.findByLabelText("Play Hola"));
  await waitFor(() => expect(picked).toEqual(["Mónica"]));
  // Switch to male → Jorge.
  fireEvent.click(screen.getByText("🚹 Male"));
  fireEvent.click(screen.getByLabelText("Play Hola"));
  await waitFor(() => expect(picked).toEqual(["Mónica", "Jorge"]));
});
