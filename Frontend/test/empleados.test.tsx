import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Empleados } from "../src/componentes/Empleados";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("el dueño crea un vendedor y aparece en el equipo", async () => {
  const equipo: Array<{ id: string; nombre: string; email: string; rol: string; emprendimientoId: string }> = [
    { id: "u1", nombre: "Ana", email: "ana@dodoco.co", rol: "ADMIN", emprendimientoId: "e1" },
  ];
  servidorMock.use(
    http.get(`${BASE}/usuarios`, () => HttpResponse.json(equipo)),
    http.post(`${BASE}/usuarios`, async ({ request }) => {
      const c = (await request.json()) as { nombre: string; email: string };
      const nuevo = { id: "u2", rol: "VENDEDOR", emprendimientoId: "e1", nombre: c.nombre, email: c.email };
      equipo.push(nuevo);
      return HttpResponse.json(nuevo, { status: 201 });
    }),
  );

  render(
    <AuthProvider>
      <MemoryRouter>
        <Empleados />
      </MemoryRouter>
    </AuthProvider>,
  );

  // El admin aparece pero sin botón de quitar.
  expect(await screen.findByText("Ana")).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/nombre/i), "Valentina");
  await userEvent.type(screen.getByLabelText(/correo/i), "vale@dodoco.co");
  await userEvent.type(screen.getByLabelText(/contraseña/i), "clave12345");
  await userEvent.click(screen.getByRole("button", { name: /crear vendedor/i }));

  await waitFor(() => expect(screen.getByText("Valentina")).toBeInTheDocument());
});
