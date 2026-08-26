import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { servidorMock } from "./servidor-mock";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";

const BASE = "http://localhost:3000";

beforeEach(() => localStorage.clear());

function Sonda() {
  const { usuario, entrar, salir } = useAuth();
  return (
    <div>
      <span data-testid="quien">{usuario ? usuario.nombre : "nadie"}</span>
      <button onClick={() => entrar("a@a.co", "clave12345")}>entrar</button>
      <button onClick={salir}>salir</button>
    </div>
  );
}

it("entrar guarda al usuario y salir lo limpia", async () => {
  servidorMock.use(
    http.post(`${BASE}/auth/login`, () =>
      HttpResponse.json({
        accessToken: "acc",
        refreshToken: "ref",
        usuario: { id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "emp1" },
      }),
    ),
  );

  render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>,
  );

  expect(screen.getByTestId("quien")).toHaveTextContent("nadie");
  await userEvent.click(screen.getByText("entrar"));
  await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("Ana"));
  expect(localStorage.getItem("dodoco.refresh")).toBe("ref");

  await userEvent.click(screen.getByText("salir"));
  expect(screen.getByTestId("quien")).toHaveTextContent("nadie");
  expect(localStorage.getItem("dodoco.refresh")).toBeNull();
});
