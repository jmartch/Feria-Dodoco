import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Configuracion } from "../src/pantallas/Configuracion";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("aplica el preajuste de Bold y muestra los tres métodos", async () => {
  let metodos: Array<{ id: string; nombre: string; comisionPct: number; activo: boolean }> = [];
  servidorMock.use(
    http.get(`${BASE}/catalogo/metodos-pago`, () => HttpResponse.json(metodos)),
    http.post(`${BASE}/catalogo/metodos-pago/preajuste-bold`, () => {
      metodos = [
        { id: "m1", nombre: "Efectivo", comisionPct: 0, activo: true },
        { id: "m2", nombre: "QR", comisionPct: 150, activo: true },
        { id: "m3", nombre: "Datáfono", comisionPct: 500, activo: true },
      ];
      return HttpResponse.json(metodos, { status: 201 });
    }),
  );
  render(
    <AuthProvider>
      <MemoryRouter>
        <Configuracion />
      </MemoryRouter>
    </AuthProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /preajuste de bold/i }));
  await waitFor(() => expect(screen.getByText("Datáfono")).toBeInTheDocument());
});
