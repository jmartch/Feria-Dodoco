import "fake-indexeddb/auto";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Vender } from "../src/pantallas/Vender";
import { db } from "../src/db/base";

const BASE = "http://localhost:3000";

beforeEach(async () => {
  localStorage.clear();
  await db.ventasPendientes.clear();
  servidorMock.use(
    http.get(`${BASE}/eventos/e1/lineas`, () =>
      HttpResponse.json([{ id: "l1", nombre: "Pines", precio: 12000, origenTipo: "CATEGORIA", origenId: "c1" }]),
    ),
    http.get(`${BASE}/eventos/e1/descuentos`, () => HttpResponse.json([])),
    http.get(`${BASE}/catalogo/metodos-pago`, () =>
      HttpResponse.json([{ id: "m1", nombre: "Efectivo", comisionPct: 0, activo: true }]),
    ),
    // La sincronización de fondo que dispara "Registrar" aterriza aquí. La fila
    // queda en la base (estado sincronizada), así que el conteo total sigue en 1.
    http.post(`${BASE}/eventos/e1/ventas`, () =>
      HttpResponse.json({ id: "v1", uuid: "u1", total: 24000, metodoPagoNombre: "Efectivo", creadaEnDispositivo: "x" }, { status: 201 }),
    ),
  );
});

function pintar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/eventos/e1/vender"]}>
        <Routes>
          <Route path="/eventos/:id/vender" element={<Vender />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

it("suma subtotales en vivo y registra la venta encolándola", async () => {
  pintar();
  const fila = await screen.findByRole("listitem", { name: /pines/i });
  await userEvent.click(within(fila).getByRole("button", { name: "+" }));
  await userEvent.click(within(fila).getByRole("button", { name: "+" }));
  // Subtotal en vivo: 24.000
  expect(within(fila).getByText(/24\.000/)).toBeInTheDocument();

  // Pago exacto rellena lo recibido con el total.
  await userEvent.click(screen.getByRole("button", { name: /pago exacto/i }));
  await userEvent.click(screen.getByRole("button", { name: /registrar venta/i }));

  // La venta quedó en la cola local (local-first): una fila pendiente.
  await waitFor(async () => expect(await db.ventasPendientes.count()).toBe(1));
  const guardada = (await db.ventasPendientes.toArray())[0];
  expect(guardada.cuerpo).toMatchObject({ recibido: 24000, metodoPagoId: "m1" });
});
