import "fake-indexeddb/auto";
import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Panel } from "../src/pantallas/Panel";
import { db } from "../src/db/base";

const BASE = "http://localhost:3000";

beforeEach(async () => {
  localStorage.clear();
  await db.ventasPendientes.clear();
});

function pintar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/eventos/e1/panel"]}>
        <Routes>
          <Route path="/eventos/:id/panel" element={<Panel />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

it("muestra bruto y meta; el vendedor no ve comisiones", async () => {
  servidorMock.use(
    http.get(`${BASE}/eventos/e1/totales`, () =>
      // El backend, para un vendedor, NO manda comisiones ni neto.
      HttpResponse.json({ cantidadVentas: 3, bruto: 300000, descuentos: 0, porMetodo: [{ metodo: "Efectivo", total: 300000 }], meta: 1000000 }),
    ),
  );
  pintar();
  // "300.000" aparece en la barra de meta y en el acumulado por método: ambos son
  // correctos, así que se comprueba que aparezca (al menos una vez), no que sea único.
  expect((await screen.findAllByText(/300\.000/)).length).toBeGreaterThan(0);
  expect(screen.queryByText(/comisiones/i)).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "300000");
});
