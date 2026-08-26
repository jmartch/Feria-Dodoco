import { http, HttpResponse } from "msw";
import { servidorMock } from "./servidor-mock";
import { crearCliente } from "../src/api/cliente";
import { ErrorApi } from "../src/api/tipos";

const BASE = "http://localhost:3000";

function clienteDePrueba(over: Partial<Parameters<typeof crearCliente>[0]> = {}) {
  return crearCliente({
    baseUrl: BASE,
    obtenerAccessToken: () => "acc",
    obtenerRefreshToken: () => "ref",
    alRenovar: () => {},
    alPerderSesion: () => {},
    ...over,
  });
}

it("adjunta el token de acceso en el header Authorization", async () => {
  let visto: string | null = null;
  servidorMock.use(
    http.get(`${BASE}/eventos`, ({ request }) => {
      visto = request.headers.get("Authorization");
      return HttpResponse.json([]);
    }),
  );
  await clienteDePrueba().pedir("/eventos");
  expect(visto).toBe("Bearer acc");
});

it("convierte un error del backend en ErrorApi con su codigo y mensaje", async () => {
  servidorMock.use(
    http.post(`${BASE}/catalogo/categorias`, () =>
      HttpResponse.json({ codigo: "DATOS_INVALIDOS", mensaje: "El precio no puede ser negativo" }, { status: 400 }),
    ),
  );
  await expect(
    clienteDePrueba().pedir("/catalogo/categorias", { method: "POST", body: JSON.stringify({}) }),
  ).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS", estado: 400 });
});

it("ante un 401 renueva la sesion y reintenta una sola vez", async () => {
  let intentos = 0;
  servidorMock.use(
    http.get(`${BASE}/eventos`, ({ request }) => {
      intentos += 1;
      const auth = request.headers.get("Authorization");
      if (auth === "Bearer acc-viejo") return new HttpResponse(null, { status: 401 });
      return HttpResponse.json([{ id: "e1" }]);
    }),
    http.post(`${BASE}/auth/refresh`, () =>
      HttpResponse.json({
        accessToken: "acc-nuevo",
        refreshToken: "ref-nuevo",
        usuario: { id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "emp1" },
      }),
    ),
  );

  let token = "acc-viejo";
  let renovada = false;
  const cliente = clienteDePrueba({
    obtenerAccessToken: () => token,
    alRenovar: (sesion) => {
      token = sesion.accessToken;
      renovada = true;
    },
  });

  const datos = await cliente.pedir<Array<{ id: string }>>("/eventos");
  expect(datos).toEqual([{ id: "e1" }]);
  expect(renovada).toBe(true);
  expect(intentos).toBe(2); // el 401 y el reintento con el token nuevo
});

it("si la renovacion tambien falla, avisa que se perdio la sesion", async () => {
  servidorMock.use(
    http.get(`${BASE}/eventos`, () => new HttpResponse(null, { status: 401 })),
    http.post(`${BASE}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
  );
  let perdida = false;
  const cliente = clienteDePrueba({ alPerderSesion: () => (perdida = true) });

  await expect(cliente.pedir("/eventos")).rejects.toBeInstanceOf(ErrorApi);
  expect(perdida).toBe(true);
});
