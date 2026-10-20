import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Login } from "./Login";

vi.mock("../api", () => ({
  api: { profiles: () => Promise.resolve([{ id: 1, name: "Jugador 1", avatar: "🧑" }]) },
}));

test("renders a profile button from the API", async () => {
  render(<Login onLoggedIn={() => {}} />);
  expect(await screen.findByText(/Jugador 1/)).toBeInTheDocument();
});
