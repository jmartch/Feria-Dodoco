import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Configuracion } from "../src/pantallas/Configuracion";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("muestra los métodos de pago (que vienen por defecto) en solo lectura", async () => {
  servidorMock.use(
    http.get(`${BASE}/catalogo/metodos-pago`, () =>
      HttpResponse.json([
        { id: "m1", nombre: "Efectivo", comisionPct: 0, activo: true },
        { id: "m2", nombre: "QR", comisionPct: 150, activo: true },
        { id: "m3", nombre: "Datáfono", comisionPct: 500, activo: true },
      ]),
    ),
    // La lista del equipo la pide el bloque de Empleados dentro de Configuración.
    http.get(`${BASE}/usuarios`, () => HttpResponse.json([])),
  );
  render(
    <AuthProvider>
      <MemoryRouter>
        <Configuracion />
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(await screen.findByText("Datáfono")).toBeInTheDocument();
  // Ya no se crean ni se aplican presets a mano.
  expect(screen.queryByRole("button", { name: /preajuste de bold/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /agregar método/i })).not.toBeInTheDocument();
});
