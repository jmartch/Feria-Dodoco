import { render, screen } from "@testing-library/react";
import { App } from "../src/App";

it("muestra el nombre de la tienda", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "Dodoco Store" })).toBeInTheDocument();
});
