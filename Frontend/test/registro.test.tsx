import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Registro } from "../src/pantallas/Registro";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("crea el emprendimiento y entra (registro + login encadenados)", async () => {
  servidorMock.use(
    http.post(`${BASE}/auth/registro`, () =>
      HttpResponse.json({ usuario: { id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "emp1" } }, { status: 201 }),
    ),
    http.post(`${BASE}/auth/login`, () =>
      HttpResponse.json({
        accessToken: "acc", refreshToken: "ref",
        usuario: { id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "emp1" },
      }),
    ),
  );
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/registro"]}>
        <Routes>
          <Route path="/registro" element={<Registro />} />
          <Route path="/eventos" element={<h1>Eventos</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
  await userEvent.type(screen.getByLabelText(/nombre del emprendimiento/i), "Dodoco");
  await userEvent.type(screen.getByLabelText(/tu nombre/i), "Ana");
  await userEvent.type(screen.getByLabelText(/correo/i), "a@a.co");
  await userEvent.type(screen.getByLabelText(/contraseña/i), "clave12345");
  await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
  await waitFor(() => expect(screen.getByRole("heading", { name: /eventos/i })).toBeInTheDocument());
});
