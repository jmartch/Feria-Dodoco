import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Rutas } from "../src/router";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

function pintar(ruta: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <Rutas />
      </MemoryRouter>
    </AuthProvider>,
  );
}

it("sin sesion, una ruta protegida manda a login", async () => {
  pintar("/eventos");
  await waitFor(() => expect(screen.getByRole("heading", { name: /entrar/i })).toBeInTheDocument());
});

it("con sesion de vendedor, configuracion redirige a eventos", async () => {
  servidorMock.use(
    http.post(`${BASE}/auth/login`, () =>
      HttpResponse.json({
        accessToken: "acc", refreshToken: "ref",
        usuario: { id: "u1", email: "v@v.co", nombre: "Vale", rol: "VENDEDOR", emprendimientoId: "emp1" },
      }),
    ),
    http.get(`${BASE}/eventos`, () => HttpResponse.json([])),
  );

  pintar("/login");
  await userEvent.type(screen.getByLabelText(/correo/i), "v@v.co");
  await userEvent.type(screen.getByLabelText(/contraseña/i), "clave12345");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

  await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument());
});
