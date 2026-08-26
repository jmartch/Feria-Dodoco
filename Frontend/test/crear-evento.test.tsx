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

it("un admin crea un evento con sus fechas y aparece en la lista", async () => {
  const eventos: Array<Record<string, unknown>> = [];
  servidorMock.use(
    http.post(`${BASE}/auth/login`, () =>
      HttpResponse.json({
        accessToken: "acc", refreshToken: "ref",
        usuario: { id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "emp1" },
      }),
    ),
    http.get(`${BASE}/eventos`, () => HttpResponse.json(eventos)),
    http.post(`${BASE}/eventos`, async ({ request }) => {
      const cuerpo = (await request.json()) as Record<string, unknown>;
      const creado = { id: "e1", catalogoBloqueado: false, estado: "ACTIVO", ...cuerpo };
      eventos.push(creado);
      return HttpResponse.json(creado, { status: 201 });
    }),
  );

  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Rutas />
      </MemoryRouter>
    </AuthProvider>,
  );

  // Entrar como admin.
  await userEvent.type(screen.getByLabelText(/correo/i), "a@a.co");
  await userEvent.type(screen.getByLabelText(/contraseña/i), "clave12345");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

  // Ya en Eventos: la forma de crear solo la ve el admin.
  await screen.findByRole("heading", { name: /crear evento/i });
  await userEvent.type(screen.getByLabelText("Nombre"), "Feria de Mayo");
  await userEvent.click(screen.getByRole("button", { name: /crear evento/i }));

  // El evento creado aparece en la lista.
  await waitFor(() => expect(screen.getByText("Feria de Mayo")).toBeInTheDocument());
});
