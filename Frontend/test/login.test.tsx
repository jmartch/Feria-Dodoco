import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Login } from "../src/pantallas/Login";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

function pintar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/eventos" element={<h1>Eventos</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

it("muestra en español el error de credenciales del backend", async () => {
  servidorMock.use(
    http.post(`${BASE}/auth/login`, () =>
      HttpResponse.json({ codigo: "CREDENCIALES_INVALIDAS", mensaje: "Correo o contraseña incorrectos" }, { status: 401 }),
    ),
  );
  pintar();
  await userEvent.type(screen.getByLabelText(/correo/i), "a@a.co");
  await userEvent.type(screen.getByLabelText(/contraseña/i), "malaclave");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos");
});

it("con credenciales válidas navega a eventos", async () => {
  servidorMock.use(
    http.post(`${BASE}/auth/login`, () =>
      HttpResponse.json({
        accessToken: "acc", refreshToken: "ref",
        usuario: { id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "emp1" },
      }),
    ),
  );
  pintar();
  await userEvent.type(screen.getByLabelText(/correo/i), "a@a.co");
  await userEvent.type(screen.getByLabelText(/contraseña/i), "clave12345");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
  await waitFor(() => expect(screen.getByRole("heading", { name: /eventos/i })).toBeInTheDocument());
});
