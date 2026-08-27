import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Gastos } from "../src/pantallas/Gastos";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("agrega un gasto y actualiza la ganancia (neto menos gastos)", async () => {
  const gastos: Array<{ id: string; concepto: string; categoria: string; monto: number; creadoEn: string }> = [];
  servidorMock.use(
    http.get(`${BASE}/eventos/e1/totales`, () =>
      HttpResponse.json({ cantidadVentas: 5, bruto: 100000, descuentos: 0, porMetodo: [], meta: 1000000, comisiones: 0, neto: 100000 }),
    ),
    http.get(`${BASE}/eventos/e1/gastos`, () =>
      HttpResponse.json({ gastos, total: gastos.reduce((s, g) => s + g.monto, 0) }),
    ),
    http.post(`${BASE}/eventos/e1/gastos`, async ({ request }) => {
      const cuerpo = (await request.json()) as { concepto: string; categoria: string; monto: number };
      const creado = { id: "g1", creadoEn: "2026-08-26T12:00:00Z", ...cuerpo };
      gastos.push(creado);
      return HttpResponse.json(creado, { status: 201 });
    }),
  );

  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/eventos/e1/gastos"]}>
        <Routes>
          <Route path="/eventos/:id/gastos" element={<Gastos />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

  // Pestaña "Ganancias" (por defecto): sin gastos, la ganancia es el neto: 100.000.
  expect((await screen.findAllByText(/100\.000/)).length).toBeGreaterThan(0);

  // El formulario de gasto vive en la pestaña "Gastos".
  await userEvent.click(screen.getByRole("tab", { name: /gastos/i }));
  await userEvent.type(screen.getByLabelText(/en qué gastaste/i), "Buses ida y vuelta");
  await userEvent.type(screen.getByLabelText(/monto/i), "20000");
  await userEvent.click(screen.getByRole("button", { name: /agregar gasto/i }));

  // El gasto aparece en la lista de la pestaña "Gastos".
  await waitFor(() => expect(screen.getByText("Buses ida y vuelta")).toBeInTheDocument());

  // Al volver a "Ganancias", la ganancia bajó a 80.000.
  await userEvent.click(screen.getByRole("tab", { name: /ganancias/i }));
  expect((await screen.findAllByText(/80\.000/)).length).toBeGreaterThan(0);
});
