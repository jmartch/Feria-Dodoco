import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Navegacion } from "../src/componentes/Navegacion";

it("el vendedor no ve enlaces de administración", () => {
  render(
    <MemoryRouter>
      <Navegacion usuario={{ id: "u1", email: "v@v.co", nombre: "Vale", rol: "VENDEDOR", emprendimientoId: "e1", nombreEmprendimiento: "Mi Tienda" }} salir={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByText(/vale/i)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /catálogo/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /salir/i })).toBeInTheDocument();
});

it("el admin ve los enlaces de administración", () => {
  render(
    <MemoryRouter>
      <Navegacion usuario={{ id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "e1", nombreEmprendimiento: "Mi Tienda" }} salir={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /catálogo/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /configuración/i })).toBeInTheDocument();
});
