import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Eventos } from "../src/pantallas/Eventos";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("lista los eventos del emprendimiento", async () => {
  servidorMock.use(
    http.get(`${BASE}/eventos`, () =>
      HttpResponse.json([
        { id: "e1", nombre: "Feria de abril", fechaInicio: "2026-04-01T00:00:00.000Z", fechaFin: null, meta: 1000000, catalogoBloqueado: false, estado: "ACTIVO" },
      ]),
    ),
  );
  render(
    <AuthProvider>
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(await screen.findByText("Feria de abril")).toBeInTheDocument();
});
