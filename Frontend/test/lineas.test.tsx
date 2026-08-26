import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Lineas } from "../src/pantallas/Lineas";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("con el candado puesto no deja añadir líneas manuales", async () => {
  servidorMock.use(
    http.get(`${BASE}/eventos/e1`, () =>
      HttpResponse.json({ id: "e1", nombre: "Feria", fechaInicio: "2026-04-01T00:00:00Z", fechaFin: null, meta: 1000000, catalogoBloqueado: true, estado: "ACTIVO" }),
    ),
    http.get(`${BASE}/eventos/e1/lineas`, () =>
      HttpResponse.json([{ id: "l1", nombre: "Pines", precio: 12000, origenTipo: "MANUAL", origenId: null }]),
    ),
  );
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/eventos/e1/lineas"]}>
        <Routes>
          <Route path="/eventos/:id/lineas" element={<Lineas />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(await screen.findByText(/Pines/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: /añadir línea/i })).toBeDisabled());
  expect(screen.getByRole("button", { name: /quitar candado/i })).toBeInTheDocument();
});
