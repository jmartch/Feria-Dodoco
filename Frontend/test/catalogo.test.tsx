import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Catalogo } from "../src/pantallas/Catalogo";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("lista y crea una categoría", async () => {
  const categorias = [{ id: "c1", nombre: "Pines", precio: 12000 }];
  servidorMock.use(
    http.get(`${BASE}/catalogo/categorias`, () => HttpResponse.json(categorias)),
    http.post(`${BASE}/catalogo/categorias`, async ({ request }) => {
      const cuerpo = (await request.json()) as { nombre: string; precio: number };
      const nueva = { id: "c2", ...cuerpo };
      categorias.push(nueva);
      return HttpResponse.json(nueva, { status: 201 });
    }),
  );
  render(
    <AuthProvider>
      <MemoryRouter>
        <Catalogo />
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(await screen.findByText(/Pines/)).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/nombre/i), "Llaveros");
  await userEvent.type(screen.getByLabelText(/precio/i), "16000");
  await userEvent.click(screen.getByRole("button", { name: /agregar producto/i }));

  await waitFor(() => expect(screen.getByText(/Llaveros/)).toBeInTheDocument());
});
