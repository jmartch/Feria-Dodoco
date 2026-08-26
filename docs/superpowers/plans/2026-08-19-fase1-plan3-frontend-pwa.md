# Fase 1 · Plan 3 — Frontend PWA offline-first

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la aplicación que usa el vendedor en la feria: una PWA instalable que registra ventas sin conexión y las sincroniza sola cuando vuelve la señal, hablando con el backend de ventas ya construido.

**Architecture:** React + Vite + TypeScript en capas: un cliente HTTP tipado que pone el token y renueva la sesión al vencer, un almacén local en IndexedDB (Dexie) con una cola que envía en segundo plano, la aritmética del dinero calculada en el dispositivo (espejo del servicio del backend) para no depender de la red, y pantallas que consumen todo eso. El estado de sesión vive en un contexto de React; el catálogo y los totales se guardan en local para arrancar sin conexión.

**Tech Stack:** React 18, Vite 5, TypeScript estricto, React Router 6, Dexie 4 (IndexedDB), vite-plugin-pwa 0.20, Vitest + Testing Library + jsdom, MSW 2 (mock del backend en pruebas). Despliegue en Vercel.

**Spec:** `docs/superpowers/specs/2026-08-17-fase1-registro-ventas-design.md`

## Global Constraints

- Todo el código en **TypeScript estricto** (`strict: true`). Sin `any` implícito.
- **El dinero se guarda y se calcula como entero de pesos.** Nunca `Float` para montos. Los porcentajes viajan en **puntos básicos enteros** (150 = 1,5 %). Todo redondeo es `Math.round`. El backend rechaza decimales, así que el frontend nunca debe enviarlos.
- **Local-first: la venta se guarda primero en el dispositivo y una cola la envía en segundo plano.** La pantalla se limpia de inmediato; nunca hay espera por la red. La aplicación se comporta igual con o sin señal.
- **`uuid` de idempotencia generado en el dispositivo** (`crypto.randomUUID()`) por cada venta. Reenviar el mismo `uuid` no duplica: el backend lo garantiza, el frontend se apoya en eso al reintentar.
- **La comisión no se le muestra al vendedor.** El panel del vendedor muestra el bruto y el acumulado por método; comisiones y neto solo se piden y se muestran cuando el rol es `ADMIN`. El backend ya oculta esos campos al vendedor; el frontend no debe intentar calcularlos ni mostrarlos.
- **Jerarquía semántica de encabezados:** un solo `h1` por pantalla (el título de la pantalla), `h2` por bloque, `h3` por subbloque.
- **Sin sourcemaps en producción:** `build.sourcemap: false` en `vite.config.ts`.
- **Contrato de error del backend:** todo error responde `{ codigo: string, mensaje: string }` con un código HTTP. El cliente HTTP normaliza cualquier fallo a esa forma; la UI muestra `mensaje` (ya viene en español).
- **Contrato de sesión:** `POST /auth/login` y `POST /auth/refresh` devuelven `{ accessToken, refreshToken, usuario }`. `POST /auth/registro` devuelve solo `{ usuario }` (sin tokens): tras registrarse hay que hacer login. `usuario` es `{ id, email, nombre, rol: "ADMIN" | "VENDEDOR", emprendimientoId }`.
- **El access token vive 15 minutos; el refresh token rota** (cada refresh devuelve uno nuevo y el anterior queda inservible). El cliente guarda siempre el último refresh token que recibió.
- **La URL del backend viene de `import.meta.env.VITE_API_URL`.** En desarrollo por defecto `http://localhost:3000`. Nunca se escribe una URL fija en el código.
- **El backend permite CORS solo desde `CORS_ORIGIN`** (por defecto `http://localhost:5173`, el puerto de Vite). No cambiar el puerto de dev sin avisar que hay que ajustar esa variable en el backend.
- Textos de interfaz **en español**.
- **Nunca ejecutar `git push`.** El usuario sube los commits él mismo. Commitear en local y avisar.
- **Windows:** usar **PowerShell** para todo comando `npm`/`npx`. Git Bash falla de forma intermitente en esta máquina con errores de fork. **Nunca** correr instalaciones ni servidores en segundo plano: van en primer plano y se espera a que terminen.

## Estructura de archivos

```
Frontend/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  .env                      VITE_API_URL de desarrollo
  .env.production           VITE_API_URL de producción (Railway)
  public/
    icon-192.png, icon-512.png, manifest se genera con el plugin
  src/
    main.tsx                monta React y el router
    App.tsx                 shell: layout, navegación, <Outlet/>
    router.tsx              rutas + guardas
    dinero/
      formato.ts            formatearPesos (Intl es-CO)
      calculo.ts            calcularVenta (espejo del backend)
    api/
      cliente.ts            fetch tipado, header Bearer, 401→refresh→reintento
      tipos.ts              tipos de las respuestas del backend
      auth.ts, catalogo.ts, eventos.ts, ventas.ts   una función por endpoint
    auth/
      AuthContext.tsx       proveedor + useAuth
      almacenamiento.ts     leer/guardar el refresh token en localStorage
    db/
      base.ts               Dexie: tablas ventasPendientes y cacheTotales
    sync/
      cola.ts               encolar, enviar en segundo plano, contar pendientes
    componentes/
      RutaProtegida.tsx, SoloAdmin.tsx, Cargando.tsx, Aviso.tsx
    pantallas/
      Login.tsx, Registro.tsx
      Eventos.tsx
      Vender.tsx
      Panel.tsx
      Lineas.tsx, Catalogo.tsx, Configuracion.tsx
  test/
    setup.ts                jsdom + matchers + MSW server
    servidor-mock.ts        handlers de MSW
```

Regla de responsabilidad: cada pantalla vive en su archivo; la lógica que no es de una sola pantalla (dinero, api, sync, auth) vive en su carpeta y se prueba por separado. Los archivos de `api/` no conocen React; los de `pantallas/` no llaman `fetch` directo, solo funciones de `api/`.

---

### Task 1: Andamiaje del proyecto y entorno de pruebas

Crea el proyecto Vite, deja las pruebas corriendo y fija la configuración que el resto del plan da por hecha (sin sourcemaps, Vitest, jsdom). Termina con una prueba de humo verde.

**Files:**
- Create: `Frontend/package.json`, `Frontend/tsconfig.json`, `Frontend/tsconfig.node.json`, `Frontend/vite.config.ts`, `Frontend/index.html`, `Frontend/.env`, `Frontend/.gitignore`
- Create: `Frontend/src/main.tsx`, `Frontend/src/App.tsx`
- Create: `Frontend/test/setup.ts`
- Test: `Frontend/test/humo.test.tsx`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: proyecto Vite en `Frontend/` con `npm test`, `npm run build`, `npm run typecheck`. `App` renderiza `<h1>Dodoco Store</h1>`. `import.meta.env.VITE_API_URL` disponible.

- [ ] **Step 1: Crear el proyecto e instalar dependencias**

En PowerShell, desde `C:\Users\tuori\OneDrive\Documentos\GitHub\Feria Dodoco`:

```powershell
New-Item -ItemType Directory -Force Frontend | Out-Null
cd Frontend
npm init -y
npm install react@^18.3.1 react-dom@^18.3.1 react-router-dom@^6.26.0 dexie@^4.0.8
npm install -D vite@^5.4.0 "@vitejs/plugin-react@^4.3.0" typescript@^5.5.0 vitest@^2.0.0 jsdom@^25.0.0 "@testing-library/react@^16.0.0" "@testing-library/jest-dom@^6.4.0" "@testing-library/user-event@^14.5.0" msw@^2.4.0 vite-plugin-pwa@^0.20.0 "@types/react@^18.3.0" "@types/react-dom@^18.3.0"
```

Instala **en primer plano** y espera. Si `npm` falla con un error de fork, reintenta el mismo comando; no lo pases a segundo plano.

- [ ] **Step 2: Escribir `package.json` (scripts y `type`)**

Reemplaza el bloque `"scripts"` y añade `"type": "module"`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Escribir `tsconfig.json` y `tsconfig.node.json`**

`Frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "test"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`Frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Escribir `vite.config.ts`**

`Frontend/vite.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Sin sourcemaps en producción: no exponer el código fuente.
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
  },
});
```

- [ ] **Step 5: Escribir `index.html`, `.env` y `.gitignore`**

`Frontend/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Dodoco Store</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`Frontend/.env`:

```
VITE_API_URL=http://localhost:3000
```

`Frontend/.gitignore`:

```
node_modules
dist
dist-ssr
*.local
.env.local
```

- [ ] **Step 6: Escribir `test/setup.ts`**

`Frontend/test/setup.ts` (por ahora sin MSW; se activa en la Task 3):

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Escribir la prueba de humo**

`Frontend/test/humo.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "../src/App";

it("muestra el nombre de la tienda", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "Dodoco Store" })).toBeInTheDocument();
});
```

- [ ] **Step 8: Correr la prueba y verla fallar**

Run (PowerShell): `npm test`
Expected: FAIL — no existe `../src/App`.

- [ ] **Step 9: Escribir `App.tsx` y `main.tsx`**

`Frontend/src/App.tsx`:

```tsx
export function App() {
  return <h1>Dodoco Store</h1>;
}
```

`Frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: Correr pruebas y typecheck**

Run: `npm test` → PASS (1 prueba).
Run: `npm run typecheck` → sin errores.

- [ ] **Step 11: Commit**

```powershell
git add Frontend
git commit -m "chore(frontend): andamiaje Vite+React+TS con Vitest"
```

---

### Task 2: Dinero — formato y cálculo en el dispositivo

La venta se calcula en el celular para funcionar sin red. Es la misma aritmética del backend (`Backend/src/services/calculo.service.ts`), reescrita aquí con sus pruebas, más el formateo a pesos colombianos. Código puro, sin React ni red.

**Files:**
- Create: `Frontend/src/dinero/formato.ts`, `Frontend/src/dinero/calculo.ts`
- Test: `Frontend/test/dinero.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `formatearPesos(valor: number): string` — entero de pesos a `"$ 12.000"` (es-CO, sin decimales).
  - `calcularVenta(entrada: EntradaCalculo): ResultadoCalculo` con
    `EntradaCalculo = { lineas: LineaVendida[]; descuentoPct: number; comisionPct: number; recibido: number }`,
    `LineaVendida = { nombre: string; precioUnitario: number; cantidad: number }`,
    `ResultadoCalculo = { items: ItemCalculado[]; subtotal: number; descuentoValor: number; total: number; comisionValor: number; neto: number; cambio: number }`,
    `ItemCalculado = LineaVendida & { subtotal: number }`. Porcentajes en puntos básicos.

- [ ] **Step 1: Escribir las pruebas que fallan**

`Frontend/test/dinero.test.ts`:

```ts
import { formatearPesos } from "../src/dinero/formato";
import { calcularVenta } from "../src/dinero/calculo";

const sinPago = { descuentoPct: 0, comisionPct: 0, recibido: 0 };

describe("formato de pesos", () => {
  it("formatea enteros sin decimales y con separador de miles", () => {
    // El espacio tras el signo puede ser un espacio duro (U+00A0) según el
    // runtime; se normaliza para comparar el contenido, no el ancho del espacio.
    const normal = (s: string) => s.replace(/\u00A0/g, " ");
    expect(normal(formatearPesos(12000))).toBe("$ 12.000");
    expect(normal(formatearPesos(0))).toBe("$ 0");
    expect(normal(formatearPesos(1500000))).toBe("$ 1.500.000");
  });
});

describe("cálculo de una venta en el dispositivo", () => {
  it("suma los subtotales de cada línea", () => {
    const r = calcularVenta({
      lineas: [
        { nombre: "Pines", precioUnitario: 12000, cantidad: 2 },
        { nombre: "Diademas", precioUnitario: 15000, cantidad: 1 },
      ],
      ...sinPago,
    });
    expect(r.items[0].subtotal).toBe(24000);
    expect(r.subtotal).toBe(39000);
    expect(r.total).toBe(39000);
  });

  it("aplica el descuento al subtotal y la comisión al total ya descontado", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 1000, // 10 % de 24000 = 2400 -> total 21600
      comisionPct: 500, // 5 % de 21600 = 1080
      recibido: 0,
    });
    expect(r.descuentoValor).toBe(2400);
    expect(r.total).toBe(21600);
    expect(r.comisionValor).toBe(1080);
    expect(r.neto).toBe(20520);
  });

  it("redondea la comisión a peso entero", () => {
    // 1,5 % de 12.345 son 185,175: debe quedar 185.
    const r = calcularVenta({
      lineas: [{ nombre: "Suelto", precioUnitario: 12345, cantidad: 1 }],
      descuentoPct: 0,
      comisionPct: 150,
      recibido: 0,
    });
    expect(r.comisionValor).toBe(185);
    expect(Number.isInteger(r.neto)).toBe(true);
  });

  it("el cambio nunca es negativo", () => {
    const sobra = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 50000,
    });
    expect(sobra.cambio).toBe(26000);
    const falta = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 10000,
    });
    expect(falta.cambio).toBe(0);
  });

  it("ignora las líneas con cantidad cero o negativa", () => {
    const r = calcularVenta({
      lineas: [
        { nombre: "Pines", precioUnitario: 12000, cantidad: 0 },
        { nombre: "Stickers", precioUnitario: 5000, cantidad: -3 },
        { nombre: "Diademas", precioUnitario: 15000, cantidad: 1 },
      ],
      ...sinPago,
    });
    expect(r.items).toHaveLength(1);
    expect(r.subtotal).toBe(15000);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- dinero`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Escribir `formato.ts`**

`Frontend/src/dinero/formato.ts`:

```ts
const formateador = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Entero de pesos a texto en pesos colombianos, sin decimales. */
export function formatearPesos(valor: number): string {
  return formateador.format(valor);
}
```

- [ ] **Step 4: Escribir `calculo.ts`** (espejo exacto del backend; mismo orden de operaciones)

`Frontend/src/dinero/calculo.ts`:

```ts
export type LineaVendida = {
  nombre: string;
  precioUnitario: number;
  cantidad: number;
};

export type ItemCalculado = LineaVendida & { subtotal: number };

export type EntradaCalculo = {
  lineas: LineaVendida[];
  /** Puntos básicos: 1000 son 10 %. */
  descuentoPct: number;
  /** Puntos básicos: 150 son 1,5 %. */
  comisionPct: number;
  recibido: number;
};

export type ResultadoCalculo = {
  items: ItemCalculado[];
  subtotal: number;
  descuentoValor: number;
  total: number;
  comisionValor: number;
  neto: number;
  cambio: number;
};

const BASE_PORCENTAJE = 10_000;

/**
 * La misma aritmética del backend, aquí para poder cobrar sin conexión. El
 * orden no es intercambiable: el descuento se aplica al subtotal y la comisión
 * al total ya descontado. Todo en enteros de pesos.
 */
export function calcularVenta(entrada: EntradaCalculo): ResultadoCalculo {
  const items = entrada.lineas
    .filter((linea) => linea.cantidad > 0)
    .map((linea) => ({ ...linea, subtotal: linea.precioUnitario * linea.cantidad }));

  const subtotal = items.reduce((suma, item) => suma + item.subtotal, 0);
  const descuentoValor = Math.round((subtotal * entrada.descuentoPct) / BASE_PORCENTAJE);
  const total = subtotal - descuentoValor;
  const comisionValor = Math.round((total * entrada.comisionPct) / BASE_PORCENTAJE);
  const neto = total - comisionValor;
  const cambio = Math.max(0, entrada.recibido - total);

  return { items, subtotal, descuentoValor, total, comisionValor, neto, cambio };
}
```

- [ ] **Step 5: Correr y ver pasar**

Run: `npm test -- dinero`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add Frontend/src/dinero Frontend/test/dinero.test.ts
git commit -m "feat(frontend): formato y calculo del dinero en el dispositivo"
```

---

### Task 3: Cliente HTTP con renovación de sesión

El único módulo que llama `fetch`. Pone el token de acceso, normaliza los errores a `{ codigo, mensaje }`, y cuando el backend responde 401 por token vencido, renueva con el refresh token y reintenta una vez. Aquí se activa MSW para probar contra un backend simulado.

**Files:**
- Create: `Frontend/src/api/tipos.ts`, `Frontend/src/api/cliente.ts`
- Modify: `Frontend/test/setup.ts`
- Create: `Frontend/test/servidor-mock.ts`
- Test: `Frontend/test/cliente.test.ts`

**Interfaces:**
- Consumes: nada del plan.
- Produces:
  - `ErrorApi` (clase) con `codigo: string`, `mensaje: string`, `estado: number`.
  - Tipos en `tipos.ts`: `Usuario`, `Sesion`, `Categoria`, `MetodoPago`, `Evento`, `EventoItem`, `Descuento`, `VentaGuardada`, `TotalesEvento` (formas del backend).
  - `crearCliente(opciones: OpcionesCliente): Cliente` con
    `OpcionesCliente = { baseUrl: string; obtenerAccessToken: () => string | null; obtenerRefreshToken: () => string | null; alRenovar: (sesion: Sesion) => void; alPerderSesion: () => void }`
    y `Cliente = { pedir: <T>(ruta: string, init?: RequestInit & { autenticar?: boolean }) => Promise<T> }`.
    `pedir` serializa/parsea JSON, lanza `ErrorApi` en fallo, y en 401 (con `autenticar` distinto de `false`) intenta renovar una vez.

- [ ] **Step 1: Activar MSW en el setup y crear el servidor mock**

Reemplaza `Frontend/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { servidorMock } from "./servidor-mock";

beforeAll(() => servidorMock.listen({ onUnhandledRequest: "error" }));
afterEach(() => servidorMock.resetHandlers());
afterAll(() => servidorMock.close());
```

`Frontend/test/servidor-mock.ts`:

```ts
import { setupServer } from "msw/node";

// Arranca sin handlers: cada prueba registra los suyos con servidorMock.use(...).
export const servidorMock = setupServer();
```

- [ ] **Step 2: Escribir las pruebas que fallan**

`Frontend/test/cliente.test.ts`:

```ts
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
```

- [ ] **Step 3: Correr y ver fallar**

Run: `npm test -- cliente`
Expected: FAIL — no existen los módulos.

- [ ] **Step 4: Escribir `tipos.ts`**

`Frontend/src/api/tipos.ts`:

```ts
export class ErrorApi extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly estado: number,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

export type Rol = "ADMIN" | "VENDEDOR";

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  emprendimientoId: string;
};

export type Sesion = {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
};

export type Categoria = { id: string; nombre: string; precio: number };
export type MetodoPago = { id: string; nombre: string; comisionPct: number; activo: boolean };

export type Evento = {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  meta: number;
  catalogoBloqueado: boolean;
  estado: "ACTIVO" | "CERRADO";
};

export type EventoItem = {
  id: string;
  nombre: string;
  precio: number;
  origenTipo: "CATEGORIA" | "PRODUCTO" | "MANUAL";
  origenId: string | null;
};

export type Descuento = { id: string; nombre: string; porcentaje: number; activo: boolean };

export type VentaGuardada = {
  id: string;
  uuid: string;
  total: number;
  metodoPagoNombre: string;
  creadaEnDispositivo: string;
};

export type TotalesEvento = {
  cantidadVentas: number;
  bruto: number;
  descuentos: number;
  porMetodo: { metodo: string; total: number }[];
  meta: number;
  // Solo presentes para ADMIN; el backend los omite al vendedor.
  comisiones?: number;
  neto?: number;
};
```

- [ ] **Step 5: Escribir `cliente.ts`**

`Frontend/src/api/cliente.ts`:

```ts
import { ErrorApi, type Sesion } from "./tipos";

export type OpcionesCliente = {
  baseUrl: string;
  obtenerAccessToken: () => string | null;
  obtenerRefreshToken: () => string | null;
  alRenovar: (sesion: Sesion) => void;
  alPerderSesion: () => void;
};

export type OpcionesPedir = RequestInit & { autenticar?: boolean };

export type Cliente = {
  pedir: <T>(ruta: string, init?: OpcionesPedir) => Promise<T>;
};

async function aError(respuesta: Response): Promise<ErrorApi> {
  // El backend siempre responde { codigo, mensaje }, pero un 401 sin cuerpo o un
  // fallo de red pueden no traerlo: se cae a un mensaje genérico.
  try {
    const cuerpo = (await respuesta.json()) as { codigo?: string; mensaje?: string };
    return new ErrorApi(
      cuerpo.codigo ?? "ERROR_DESCONOCIDO",
      cuerpo.mensaje ?? "No se pudo completar la operación",
      respuesta.status,
    );
  } catch {
    return new ErrorApi("ERROR_DESCONOCIDO", "No se pudo completar la operación", respuesta.status);
  }
}

export function crearCliente(opciones: OpcionesCliente): Cliente {
  async function ejecutar(ruta: string, init: OpcionesPedir): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (init.autenticar !== false) {
      const token = opciones.obtenerAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`${opciones.baseUrl}${ruta}`, { ...init, headers });
  }

  async function renovar(): Promise<boolean> {
    const refreshToken = opciones.obtenerRefreshToken();
    if (!refreshToken) return false;

    const respuesta = await fetch(`${opciones.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!respuesta.ok) return false;

    const sesion = (await respuesta.json()) as Sesion;
    opciones.alRenovar(sesion);
    return true;
  }

  async function pedir<T>(ruta: string, init: OpcionesPedir = {}): Promise<T> {
    let respuesta = await ejecutar(ruta, init);

    // 401 con token vencido: renovar y reintentar una sola vez. Nunca se
    // reintenta la renovación misma, para no entrar en bucle.
    if (respuesta.status === 401 && init.autenticar !== false) {
      const renovada = await renovar();
      if (!renovada) {
        opciones.alPerderSesion();
        throw await aError(respuesta);
      }
      respuesta = await ejecutar(ruta, init);
      if (respuesta.status === 401) {
        opciones.alPerderSesion();
        throw await aError(respuesta);
      }
    }

    if (!respuesta.ok) throw await aError(respuesta);
    if (respuesta.status === 204) return undefined as T;
    return (await respuesta.json()) as T;
  }

  return { pedir };
}
```

- [ ] **Step 6: Correr y ver pasar**

Run: `npm test -- cliente`
Expected: PASS — 4 pruebas.

- [ ] **Step 7: Commit**

```powershell
git add Frontend/src/api Frontend/test/cliente.test.ts Frontend/test/setup.ts Frontend/test/servidor-mock.ts
git commit -m "feat(frontend): cliente HTTP con renovacion de sesion en 401"
```

---

### Task 4: Autenticación — almacenamiento de sesión y contexto

Guarda la sesión (el access token en memoria, el refresh token en `localStorage` para sobrevivir a un cierre de la app), expone `useAuth`, y conecta el cliente HTTP a esa sesión. Registro y login usan las funciones de `api/auth.ts`.

**Files:**
- Create: `Frontend/src/auth/almacenamiento.ts`, `Frontend/src/api/auth.ts`, `Frontend/src/auth/AuthContext.tsx`
- Test: `Frontend/test/almacenamiento.test.ts`, `Frontend/test/auth-context.test.tsx`

**Interfaces:**
- Consumes: `crearCliente`, `ErrorApi`, tipos `Sesion`/`Usuario` (Task 3).
- Produces:
  - `almacenamiento` con `leerRefresh(): string | null`, `guardarRefresh(token: string): void`, `borrarRefresh(): void` (clave `dodoco.refresh`).
  - `api.auth` con `registrar(datos): Promise<{ usuario: Usuario }>`, `login(email, password): Promise<Sesion>`, `refrescar(refreshToken): Promise<Sesion>`.
  - `AuthProvider` (componente) y `useAuth(): { usuario: Usuario | null; cargando: boolean; cliente: Cliente; entrar: (email, password) => Promise<void>; registrar: (datos) => Promise<void>; salir: () => void }`.

- [ ] **Step 1: Escribir la prueba de `almacenamiento`**

`Frontend/test/almacenamiento.test.ts`:

```ts
import { beforeEach, expect, it } from "vitest";
import { almacenamiento } from "../src/auth/almacenamiento";

beforeEach(() => localStorage.clear());

it("guarda, lee y borra el refresh token", () => {
  expect(almacenamiento.leerRefresh()).toBeNull();
  almacenamiento.guardarRefresh("ref-123");
  expect(almacenamiento.leerRefresh()).toBe("ref-123");
  almacenamiento.borrarRefresh();
  expect(almacenamiento.leerRefresh()).toBeNull();
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- almacenamiento` → FAIL.

- [ ] **Step 3: Escribir `almacenamiento.ts`**

`Frontend/src/auth/almacenamiento.ts`:

```ts
const CLAVE = "dodoco.refresh";

// El refresh token vive en localStorage para reanudar la sesión tras cerrar la
// app. El access token no se persiste: es de vida corta y se pide con el
// refresh al arrancar.
export const almacenamiento = {
  leerRefresh(): string | null {
    return localStorage.getItem(CLAVE);
  },
  guardarRefresh(token: string): void {
    localStorage.setItem(CLAVE, token);
  },
  borrarRefresh(): void {
    localStorage.removeItem(CLAVE);
  },
};
```

- [ ] **Step 4: Escribir `api/auth.ts`**

`Frontend/src/api/auth.ts`:

```ts
import type { Cliente } from "./cliente";
import type { Sesion, Usuario } from "./tipos";

export type DatosRegistro = {
  nombreEmprendimiento: string;
  nombreUsuario: string;
  email: string;
  password: string;
};

export function crearApiAuth(cliente: Cliente) {
  return {
    registrar(datos: DatosRegistro) {
      return cliente.pedir<{ usuario: Usuario }>("/auth/registro", {
        method: "POST",
        body: JSON.stringify(datos),
        autenticar: false,
      });
    },
    login(email: string, password: string) {
      return cliente.pedir<Sesion>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        autenticar: false,
      });
    },
  };
}
```

- [ ] **Step 5: Escribir la prueba del contexto**

`Frontend/test/auth-context.test.tsx`:

```tsx
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
```

- [ ] **Step 6: Correr y ver fallar** — Run: `npm test -- auth-context` → FAIL.

- [ ] **Step 7: Escribir `AuthContext.tsx`**

`Frontend/src/auth/AuthContext.tsx`:

```tsx
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { crearCliente, type Cliente } from "../api/cliente";
import { crearApiAuth, type DatosRegistro } from "../api/auth";
import type { Sesion, Usuario } from "../api/tipos";
import { almacenamiento } from "./almacenamiento";

type ValorAuth = {
  usuario: Usuario | null;
  cargando: boolean;
  cliente: Cliente;
  entrar: (email: string, password: string) => Promise<void>;
  registrar: (datos: DatosRegistro) => Promise<void>;
  salir: () => void;
};

const Contexto = createContext<ValorAuth | null>(null);

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando] = useState(false);
  // El access token vive en una ref (memoria), no en el estado: cambiarlo no
  // debe re-renderizar, y no debe persistirse.
  const accessRef = useRef<string | null>(null);

  const cliente = useMemo(
    () =>
      crearCliente({
        baseUrl: BASE_URL,
        obtenerAccessToken: () => accessRef.current,
        obtenerRefreshToken: () => almacenamiento.leerRefresh(),
        alRenovar: (sesion) => aplicarSesion(sesion),
        alPerderSesion: () => limpiarSesion(),
      }),
    [],
  );

  function aplicarSesion(sesion: Sesion) {
    accessRef.current = sesion.accessToken;
    almacenamiento.guardarRefresh(sesion.refreshToken);
    setUsuario(sesion.usuario);
  }

  function limpiarSesion() {
    accessRef.current = null;
    almacenamiento.borrarRefresh();
    setUsuario(null);
  }

  const auth = crearApiAuth(cliente);

  async function entrar(email: string, password: string) {
    aplicarSesion(await auth.login(email, password));
  }

  async function registrar(datos: DatosRegistro) {
    // El registro no devuelve tokens: tras crear la cuenta se entra con las
    // mismas credenciales.
    await auth.registrar(datos);
    await entrar(datos.email, datos.password);
  }

  const valor: ValorAuth = { usuario, cargando, cliente, entrar, registrar, salir: limpiarSesion };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ValorAuth {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return valor;
}
```

- [ ] **Step 8: Correr pruebas y typecheck**

Run: `npm test` → PASS (todo verde).
Run: `npm run typecheck` → sin errores.

- [ ] **Step 9: Commit**

```powershell
git add Frontend/src/auth Frontend/src/api/auth.ts Frontend/test/almacenamiento.test.ts Frontend/test/auth-context.test.tsx
git commit -m "feat(frontend): sesion en contexto con access en memoria y refresh persistido"
```

---

### Task 5: Almacén local y cola de sincronización

Cada venta se guarda primero en IndexedDB con estado `pendiente` y se envía en segundo plano; al confirmar el servidor pasa a `sincronizada`. Reintenta con espera creciente y se apoya en el `uuid` para no duplicar. Expone el conteo de pendientes para el aviso de la UI.

**Files:**
- Create: `Frontend/src/db/base.ts`, `Frontend/src/api/ventas.ts`, `Frontend/src/sync/cola.ts`
- Test: `Frontend/test/cola.test.ts`

**Interfaces:**
- Consumes: `Cliente` (Task 3), tipo `VentaGuardada`.
- Produces:
  - `db` (Dexie) con tabla `ventasPendientes` (`uuid` clave primaria, campos: `eventoId`, `cuerpo` (el JSON que espera `POST /eventos/:id/ventas`), `estado: "pendiente" | "sincronizada"`, `intentos`, `creadaEn`).
  - `crearApiVentas(cliente)` con `registrar(eventoId, cuerpo): Promise<VentaGuardada>`, `totales(eventoId): Promise<TotalesEvento>`, `listar(eventoId): Promise<VentaGuardada[]>`.
  - `CuerpoVenta = { uuid: string; lineas: {nombre, precioUnitario, cantidad}[]; metodoPagoId: string; descuentoId: string | null; recibido: number; creadaEnDispositivo: string }`.
  - `crearCola(apiVentas)` con `encolar(eventoId, cuerpo): Promise<void>`, `sincronizar(): Promise<{ enviadas: number; pendientes: number }>`, `contarPendientes(): Promise<number>`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`Frontend/test/cola.test.ts`:

```ts
import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "../src/db/base";
import { crearCola, type CuerpoVenta } from "../src/sync/cola";
import type { VentaGuardada } from "../src/api/tipos";

function cuerpo(uuid: string): CuerpoVenta {
  return {
    uuid,
    lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 1 }],
    metodoPagoId: "m1",
    descuentoId: null,
    recibido: 12000,
    creadaEnDispositivo: new Date().toISOString(),
  };
}

beforeEach(async () => {
  await db.ventasPendientes.clear();
});

it("encolar guarda la venta como pendiente", async () => {
  const cola = crearCola({ registrar: vi.fn(), totales: vi.fn(), listar: vi.fn() });
  await cola.encolar("e1", cuerpo("u1"));
  expect(await cola.contarPendientes()).toBe(1);
});

it("sincronizar envia las pendientes y las marca sincronizadas", async () => {
  const registrar = vi.fn(async (): Promise<VentaGuardada> => ({
    id: "v1",
    uuid: "u1",
    total: 12000,
    metodoPagoNombre: "Efectivo",
    creadaEnDispositivo: new Date().toISOString(),
  }));
  const cola = crearCola({ registrar, totales: vi.fn(), listar: vi.fn() });

  await cola.encolar("e1", cuerpo("u1"));
  const res = await cola.sincronizar();

  expect(registrar).toHaveBeenCalledWith("e1", expect.objectContaining({ uuid: "u1" }));
  expect(res).toEqual({ enviadas: 1, pendientes: 0 });
  expect(await cola.contarPendientes()).toBe(0);
});

it("una venta que falla al enviar queda pendiente y suma un intento", async () => {
  const registrar = vi.fn(async () => {
    throw new Error("sin red");
  });
  const cola = crearCola({ registrar, totales: vi.fn(), listar: vi.fn() });

  await cola.encolar("e1", cuerpo("u1"));
  const res = await cola.sincronizar();

  expect(res).toEqual({ enviadas: 0, pendientes: 1 });
  const guardada = await db.ventasPendientes.get("u1");
  expect(guardada?.estado).toBe("pendiente");
  expect(guardada?.intentos).toBe(1);
});

it("no reenvia una venta ya sincronizada", async () => {
  const registrar = vi.fn(async (): Promise<VentaGuardada> => ({
    id: "v1", uuid: "u1", total: 12000, metodoPagoNombre: "Efectivo", creadaEnDispositivo: "x",
  }));
  const cola = crearCola({ registrar, totales: vi.fn(), listar: vi.fn() });

  await cola.encolar("e1", cuerpo("u1"));
  await cola.sincronizar();
  await cola.sincronizar();

  expect(registrar).toHaveBeenCalledTimes(1);
});
```

Instala el mock de IndexedDB (primer plano):

```powershell
npm install -D fake-indexeddb@^6.0.0
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- cola` → FAIL (no existen los módulos).

- [ ] **Step 3: Escribir `db/base.ts`**

`Frontend/src/db/base.ts`:

```ts
import Dexie, { type Table } from "dexie";

export type VentaPendiente = {
  uuid: string;
  eventoId: string;
  cuerpo: unknown;
  estado: "pendiente" | "sincronizada";
  intentos: number;
  creadaEn: string;
};

class BaseDodoco extends Dexie {
  ventasPendientes!: Table<VentaPendiente, string>;

  constructor() {
    super("dodoco");
    // `uuid` es la clave primaria: reencolar la misma venta la sobrescribe en
    // vez de duplicarla. `estado` indexado para buscar las pendientes rápido.
    this.version(1).stores({ ventasPendientes: "uuid, estado, eventoId" });
  }
}

export const db = new BaseDodoco();
```

- [ ] **Step 4: Escribir `api/ventas.ts`**

`Frontend/src/api/ventas.ts`:

```ts
import type { Cliente } from "./cliente";
import type { TotalesEvento, VentaGuardada } from "./tipos";

export function crearApiVentas(cliente: Cliente) {
  return {
    registrar(eventoId: string, cuerpo: unknown) {
      return cliente.pedir<VentaGuardada>(`/eventos/${eventoId}/ventas`, {
        method: "POST",
        body: JSON.stringify(cuerpo),
      });
    },
    listar(eventoId: string) {
      return cliente.pedir<VentaGuardada[]>(`/eventos/${eventoId}/ventas`);
    },
    totales(eventoId: string) {
      return cliente.pedir<TotalesEvento>(`/eventos/${eventoId}/totales`);
    },
  };
}

export type ApiVentas = ReturnType<typeof crearApiVentas>;
```

- [ ] **Step 5: Escribir `sync/cola.ts`**

`Frontend/src/sync/cola.ts`:

```ts
import { db } from "../db/base";
import type { ApiVentas } from "../api/ventas";

export type CuerpoVenta = {
  uuid: string;
  lineas: { nombre: string; precioUnitario: number; cantidad: number }[];
  metodoPagoId: string;
  descuentoId: string | null;
  recibido: number;
  creadaEnDispositivo: string;
};

export function crearCola(apiVentas: ApiVentas) {
  async function encolar(eventoId: string, cuerpo: CuerpoVenta): Promise<void> {
    await db.ventasPendientes.put({
      uuid: cuerpo.uuid,
      eventoId,
      cuerpo,
      estado: "pendiente",
      intentos: 0,
      creadaEn: new Date().toISOString(),
    });
  }

  async function contarPendientes(): Promise<number> {
    return db.ventasPendientes.where("estado").equals("pendiente").count();
  }

  async function sincronizar(): Promise<{ enviadas: number; pendientes: number }> {
    const pendientes = await db.ventasPendientes.where("estado").equals("pendiente").toArray();
    let enviadas = 0;

    for (const venta of pendientes) {
      try {
        await apiVentas.registrar(venta.eventoId, venta.cuerpo);
        // El backend es idempotente por uuid: si esta venta ya había entrado en
        // un envío cuya respuesta se perdió, reenviarla no duplica.
        await db.ventasPendientes.update(venta.uuid, { estado: "sincronizada" });
        enviadas += 1;
      } catch {
        await db.ventasPendientes.update(venta.uuid, { intentos: venta.intentos + 1 });
      }
    }

    return { enviadas, pendientes: await contarPendientes() };
  }

  return { encolar, sincronizar, contarPendientes };
}
```

- [ ] **Step 6: Correr y ver pasar** — Run: `npm test -- cola` → PASS.

- [ ] **Step 7: Commit**

```powershell
git add Frontend/src/db Frontend/src/sync Frontend/src/api/ventas.ts Frontend/test/cola.test.ts Frontend/package.json Frontend/package-lock.json
git commit -m "feat(frontend): almacen local y cola de sincronizacion de ventas"
```

---

### Task 6: Rutas, guardas y shell de la aplicación

Arma el enrutado, la guarda de sesión (sin usuario → a login) y la de admin (vendedor no entra a pantallas de administración), y el layout con la navegación. Deja pantallas mínimas de marcador para poder probar la navegación; el contenido real llega en las tareas siguientes.

**Files:**
- Create: `Frontend/src/router.tsx`, `Frontend/src/componentes/RutaProtegida.tsx`, `Frontend/src/componentes/SoloAdmin.tsx`
- Modify: `Frontend/src/App.tsx`, `Frontend/src/main.tsx`
- Create marcadores: `Frontend/src/pantallas/Login.tsx`, `Eventos.tsx`, `Configuracion.tsx` (mínimos; se completan luego)
- Test: `Frontend/test/router.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `AuthProvider` (Task 4).
- Produces:
  - `RutaProtegida` (redirige a `/login` si no hay usuario).
  - `SoloAdmin` (redirige a `/eventos` si el rol no es `ADMIN`).
  - `AppRouter` (componente) que monta `AuthProvider` + `BrowserRouter` + rutas. `App` renderiza `AppRouter`.

- [ ] **Step 1: Escribir la prueba de rutas**

`Frontend/test/router.test.tsx`:

```tsx
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
  // Entra como vendedor desde la pantalla de login (marcador con un botón).
  await userEvent.type(screen.getByLabelText(/correo/i), "v@v.co");
  await userEvent.type(screen.getByLabelText(/contraseña/i), "clave12345");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

  await waitFor(() => expect(screen.getByRole("heading", { name: /eventos/i })).toBeInTheDocument());
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- router` → FAIL.

- [ ] **Step 3: Escribir las guardas**

`Frontend/src/componentes/RutaProtegida.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RutaProtegida() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

`Frontend/src/componentes/SoloAdmin.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function SoloAdmin() {
  const { usuario } = useAuth();
  // El vendedor no ve las pantallas de administración; se le devuelve a eventos.
  if (usuario?.rol !== "ADMIN") return <Navigate to="/eventos" replace />;
  return <Outlet />;
}
```

- [ ] **Step 4: Escribir marcadores de pantalla**

`Frontend/src/pantallas/Login.tsx` (marcador funcional; se completa en la Task 7):

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    await entrar(email, password);
    navegar("/eventos");
  }

  return (
    <form onSubmit={enviar}>
      <h1>Entrar</h1>
      <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button type="submit">Entrar</button>
    </form>
  );
}
```

`Frontend/src/pantallas/Eventos.tsx` (marcador; se completa en la Task 8):

```tsx
export function Eventos() {
  return <h1>Eventos</h1>;
}
```

`Frontend/src/pantallas/Configuracion.tsx` (marcador; se completa en la Task 13):

```tsx
export function Configuracion() {
  return <h1>Configuración</h1>;
}
```

- [ ] **Step 5: Escribir `router.tsx`**

`Frontend/src/router.tsx`:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RutaProtegida } from "./componentes/RutaProtegida";
import { SoloAdmin } from "./componentes/SoloAdmin";
import { Login } from "./pantallas/Login";
import { Eventos } from "./pantallas/Eventos";
import { Configuracion } from "./pantallas/Configuracion";

// Rutas sin el BrowserRouter, para poder envolverlas con MemoryRouter en pruebas.
export function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RutaProtegida />}>
        <Route path="/eventos" element={<Eventos />} />
        <Route element={<SoloAdmin />}>
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/eventos" replace />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Rutas />
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Conectar `App.tsx`**

`Frontend/src/App.tsx`:

```tsx
import { AuthProvider } from "./auth/AuthContext";
import { AppRouter } from "./router";

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
```

Y quita la prueba de humo vieja que esperaba `<h1>Dodoco Store</h1>`: bórrala (`Frontend/test/humo.test.tsx`), su función la cumple ahora `router.test.tsx`.

- [ ] **Step 7: Correr pruebas y typecheck**

Run: `npm test` → PASS.
Run: `npm run typecheck` → sin errores.

- [ ] **Step 8: Commit**

```powershell
git add Frontend/src Frontend/test
git rm Frontend/test/humo.test.tsx
git commit -m "feat(frontend): rutas, guardas de sesion y de admin, y shell"
```

---

### Task 7: Pantallas de Login y Registro

Completa el login (ya esbozado como marcador) y añade el registro, que crea el emprendimiento y entra. Muestra el error del backend en español y no deja enviar dos veces.

**Files:**
- Modify: `Frontend/src/pantallas/Login.tsx`
- Create: `Frontend/src/pantallas/Registro.tsx`, `Frontend/src/componentes/Aviso.tsx`
- Modify: `Frontend/src/router.tsx` (añadir `/registro`)
- Test: `Frontend/test/login.test.tsx`, `Frontend/test/registro.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`entrar`, `registrar`), `ErrorApi`.
- Produces: `Login` y `Registro` (componentes con `<h1>`); `Aviso` (`{ mensaje: string }` → `role="alert"`).

- [ ] **Step 1: Escribir las pruebas**

`Frontend/test/login.test.tsx`:

```tsx
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
```

`Frontend/test/registro.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- login registro` → FAIL.

- [ ] **Step 3: Escribir `Aviso.tsx`**

`Frontend/src/componentes/Aviso.tsx`:

```tsx
export function Aviso({ mensaje }: { mensaje: string }) {
  return <p role="alert">{mensaje}</p>;
}
```

- [ ] **Step 4: Escribir `Login.tsx` (versión completa)**

`Frontend/src/pantallas/Login.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorApi } from "../api/tipos";
import { Aviso } from "../componentes/Aviso";

export function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await entrar(email, password);
      navegar("/eventos");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo entrar. Revisa tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <h1>Entrar</h1>
      {error && <Aviso mensaje={error} />}
      <label>
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Contraseña
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button type="submit" disabled={enviando}>Entrar</button>
      <p>
        ¿No tienes cuenta? <Link to="/registro">Crea tu emprendimiento</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 5: Escribir `Registro.tsx`**

`Frontend/src/pantallas/Registro.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorApi } from "../api/tipos";
import { Aviso } from "../componentes/Aviso";

export function Registro() {
  const { registrar } = useAuth();
  const navegar = useNavigate();
  const [nombreEmprendimiento, setNombreEmprendimiento] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await registrar({ nombreEmprendimiento, nombreUsuario, email, password });
      navegar("/eventos");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <h1>Crear emprendimiento</h1>
      {error && <Aviso mensaje={error} />}
      <label>
        Nombre del emprendimiento
        <input value={nombreEmprendimiento} onChange={(e) => setNombreEmprendimiento(e.target.value)} required />
      </label>
      <label>
        Tu nombre
        <input value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} required />
      </label>
      <label>
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Contraseña
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      </label>
      <button type="submit" disabled={enviando}>Crear cuenta</button>
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Entrar</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 6: Añadir la ruta `/registro`** en `Frontend/src/router.tsx`, importando `Registro` y agregando dentro de `<Routes>`, junto a `/login`:

```tsx
<Route path="/registro" element={<Registro />} />
```

- [ ] **Step 7: Correr pruebas y typecheck** — `npm test` → PASS; `npm run typecheck` → limpio.

- [ ] **Step 8: Commit**

```powershell
git add Frontend/src Frontend/test/login.test.tsx Frontend/test/registro.test.tsx
git commit -m "feat(frontend): pantallas de login y registro"
```

---

### Task 8: Pantalla de Eventos

Lista los eventos del emprendimiento y deja elegir en cuál se trabaja. Muestra "Cargando…" mientras pide y un aviso si falla.

**Files:**
- Create: `Frontend/src/api/eventos.ts`, `Frontend/src/componentes/Cargando.tsx`
- Modify: `Frontend/src/pantallas/Eventos.tsx`
- Test: `Frontend/test/eventos.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`cliente`), tipos `Evento`, `EventoItem`, `Categoria`, `MetodoPago`, `Descuento`.
- Produces:
  - `crearApiEventos(cliente)` con `listar()`, `crear(datos)`, `buscar(id)`, `cambiarCandado(id, bloqueado)`, `listarLineas(id)`, `crearLinea(id, cuerpo)`, `eliminarLinea(id, lineaId)`, `listarDescuentos(id)`, `crearDescuento(id, cuerpo)`. Formas: ver Task 8 y Tasks 11-12.
  - `Cargando` (`{ que?: string }` → texto "Cargando…").
  - `Eventos` que pinta la lista con enlaces a `/eventos/:id/vender`.

- [ ] **Step 1: Escribir la prueba**

`Frontend/test/eventos.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
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
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- eventos` → FAIL.

- [ ] **Step 3: Escribir `api/eventos.ts`**

`Frontend/src/api/eventos.ts`:

```ts
import type { Cliente } from "./cliente";
import type { Descuento, Evento, EventoItem } from "./tipos";

export function crearApiEventos(cliente: Cliente) {
  return {
    listar: () => cliente.pedir<Evento[]>("/eventos"),
    crear: (datos: { nombre: string; fechaInicio: string; fechaFin: string | null; meta: number }) =>
      cliente.pedir<Evento>("/eventos", { method: "POST", body: JSON.stringify(datos) }),
    buscar: (id: string) => cliente.pedir<Evento>(`/eventos/${id}`),
    cambiarCandado: (id: string, bloqueado: boolean) =>
      cliente.pedir<Evento>(`/eventos/${id}/candado`, { method: "PATCH", body: JSON.stringify({ bloqueado }) }),
    listarLineas: (id: string) => cliente.pedir<EventoItem[]>(`/eventos/${id}/lineas`),
    crearLinea: (id: string, cuerpo: { categoriaId: string } | { nombre: string; precio: number }) =>
      cliente.pedir<EventoItem>(`/eventos/${id}/lineas`, { method: "POST", body: JSON.stringify(cuerpo) }),
    eliminarLinea: (id: string, lineaId: string) =>
      cliente.pedir<void>(`/eventos/${id}/lineas/${lineaId}`, { method: "DELETE" }),
    listarDescuentos: (id: string) => cliente.pedir<Descuento[]>(`/eventos/${id}/descuentos`),
    crearDescuento: (id: string, cuerpo: { nombre: string; porcentaje: number; activo: boolean }) =>
      cliente.pedir<Descuento>(`/eventos/${id}/descuentos`, { method: "POST", body: JSON.stringify(cuerpo) }),
  };
}

export type ApiEventos = ReturnType<typeof crearApiEventos>;
```

- [ ] **Step 4: Escribir `Cargando.tsx`**

`Frontend/src/componentes/Cargando.tsx`:

```tsx
export function Cargando({ que = "" }: { que?: string }) {
  return <p role="status">Cargando{que ? ` ${que}` : ""}…</p>;
}
```

- [ ] **Step 5: Escribir `Eventos.tsx`**

`Frontend/src/pantallas/Eventos.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import type { Evento } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";
import { Aviso } from "../componentes/Aviso";

export function Eventos() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiEventos(cliente), [cliente]);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listar()
      .then(setEventos)
      .catch(() => setError("No se pudieron cargar los eventos."));
  }, [api]);

  if (error) return <Aviso mensaje={error} />;
  if (!eventos) return <Cargando que="los eventos" />;

  return (
    <section>
      <h1>Eventos</h1>
      {eventos.length === 0 ? (
        <p>Aún no hay eventos.</p>
      ) : (
        <ul>
          {eventos.map((evento) => (
            <li key={evento.id}>
              <Link to={`/eventos/${evento.id}/vender`}>{evento.nombre}</Link>
              {" · "}
              <Link to={`/eventos/${evento.id}/panel`}>Panel</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Correr pruebas y typecheck** — PASS y limpio.

- [ ] **Step 7: Commit**

```powershell
git add Frontend/src Frontend/test/eventos.test.tsx
git commit -m "feat(frontend): pantalla de eventos"
```

---

### Task 9: Pantalla de Vender (la calculadora)

El corazón de la app. Muestra las líneas del evento con controles de cantidad y subtotales en vivo, los descuentos activables, el método de pago, el botón "Pago exacto", el monto recibido y el cambio. Al registrar, encola la venta (local-first) y limpia la pantalla de inmediato; dispara la sincronización sin bloquear.

**Files:**
- Create: `Frontend/src/pantallas/Vender.tsx`
- Modify: `Frontend/src/router.tsx` (ruta `/eventos/:id/vender`)
- Test: `Frontend/test/vender.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`cliente`), `crearApiEventos`, `crearApiVentas`, `crearCola`, `calcularVenta`, `formatearPesos`.
- Produces: `Vender` (pantalla). Encola con `CuerpoVenta` (Task 5). El precio de cada línea sale de `EventoItem.precio`; la comisión, del método elegido; el descuento, del `Descuento` activo.

- [ ] **Step 1: Escribir la prueba**

`Frontend/test/vender.test.tsx`:

```tsx
import "fake-indexeddb/auto";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Vender } from "../src/pantallas/Vender";
import { db } from "../src/db/base";

const BASE = "http://localhost:3000";

beforeEach(async () => {
  localStorage.clear();
  await db.ventasPendientes.clear();
  servidorMock.use(
    http.get(`${BASE}/eventos/e1`, () =>
      HttpResponse.json({ id: "e1", nombre: "Feria", fechaInicio: "2026-04-01T00:00:00Z", fechaFin: null, meta: 1000000, catalogoBloqueado: true, estado: "ACTIVO" }),
    ),
    http.get(`${BASE}/eventos/e1/lineas`, () =>
      HttpResponse.json([{ id: "l1", nombre: "Pines", precio: 12000, origenTipo: "CATEGORIA", origenId: "c1" }]),
    ),
    http.get(`${BASE}/eventos/e1/descuentos`, () => HttpResponse.json([])),
    http.get(`${BASE}/catalogo/metodos-pago`, () =>
      HttpResponse.json([{ id: "m1", nombre: "Efectivo", comisionPct: 0, activo: true }]),
    ),
  );
});

function pintar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/eventos/e1/vender"]}>
        <Routes>
          <Route path="/eventos/:id/vender" element={<Vender />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

it("suma subtotales en vivo y registra la venta encolándola", async () => {
  pintar();
  const fila = await screen.findByRole("listitem", { name: /pines/i });
  // Sube la cantidad a 2 con el botón +.
  await userEvent.click(within(fila).getByRole("button", { name: "+" }));
  await userEvent.click(within(fila).getByRole("button", { name: "+" }));
  // Subtotal en vivo: 24.000
  expect(within(fila).getByText(/24\.000/)).toBeInTheDocument();

  // Pago exacto rellena lo recibido con el total.
  await userEvent.click(screen.getByRole("button", { name: /pago exacto/i }));
  await userEvent.click(screen.getByRole("button", { name: /registrar venta/i }));

  // La venta quedó en la cola local (local-first): una fila pendiente.
  await waitFor(async () => expect(await db.ventasPendientes.count()).toBe(1));
  const guardada = (await db.ventasPendientes.toArray())[0];
  expect(guardada.cuerpo).toMatchObject({ recibido: 24000, metodoPagoId: "m1" });
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- vender` → FAIL.

- [ ] **Step 3: Escribir `Vender.tsx`**

`Frontend/src/pantallas/Vender.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import { crearApiVentas } from "../api/ventas";
import { crearCola } from "../sync/cola";
import { calcularVenta } from "../dinero/calculo";
import { formatearPesos } from "../dinero/formato";
import type { Descuento, EventoItem, MetodoPago } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Vender() {
  const { id: eventoId = "" } = useParams();
  const { cliente } = useAuth();
  const apiEventos = useMemo(() => crearApiEventos(cliente), [cliente]);
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);
  const cola = useMemo(() => crearCola(apiVentas), [apiVentas]);

  const [lineas, setLineas] = useState<EventoItem[] | null>(null);
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [descuentoId, setDescuentoId] = useState<string | null>(null);
  const [metodoId, setMetodoId] = useState<string>("");
  const [recibido, setRecibido] = useState<number>(0);

  useEffect(() => {
    Promise.all([
      apiEventos.listarLineas(eventoId),
      apiEventos.listarDescuentos(eventoId),
      cliente.pedir<MetodoPago[]>("/catalogo/metodos-pago"),
    ]).then(([ls, ds, ms]) => {
      setLineas(ls);
      setDescuentos(ds.filter((d) => d.activo));
      setMetodos(ms.filter((m) => m.activo));
      if (ms[0]) setMetodoId(ms[0].id);
    });
  }, [apiEventos, cliente, eventoId]);

  const descuentoActivo = descuentos.find((d) => d.id === descuentoId) ?? null;
  const metodoActivo = metodos.find((m) => m.id === metodoId) ?? null;

  const calculo = useMemo(() => {
    const items = (lineas ?? []).map((l) => ({
      nombre: l.nombre,
      precioUnitario: l.precio,
      cantidad: cantidades[l.id] ?? 0,
    }));
    return calcularVenta({
      lineas: items,
      // El vendedor no ve la comisión, pero se guarda para el registro contable.
      descuentoPct: descuentoActivo?.porcentaje ?? 0,
      comisionPct: metodoActivo?.comisionPct ?? 0,
      recibido,
    });
  }, [lineas, cantidades, descuentoActivo, metodoActivo, recibido]);

  function cambiarCantidad(lineaId: string, delta: number) {
    setCantidades((prev) => ({ ...prev, [lineaId]: Math.max(0, (prev[lineaId] ?? 0) + delta) }));
  }

  async function registrar() {
    if (calculo.total <= 0 || !metodoActivo) return;
    const cuerpo = {
      uuid: crypto.randomUUID(),
      lineas: calculo.items.map((i) => ({ nombre: i.nombre, precioUnitario: i.precioUnitario, cantidad: i.cantidad })),
      metodoPagoId: metodoActivo.id,
      descuentoId: descuentoActivo?.id ?? null,
      recibido,
      creadaEnDispositivo: new Date().toISOString(),
    };
    // Local-first: se guarda y se limpia sin esperar a la red. La cola envía sola.
    await cola.encolar(eventoId, cuerpo);
    setCantidades({});
    setRecibido(0);
    setDescuentoId(null);
    void cola.sincronizar();
  }

  if (!lineas) return <Cargando que="la venta" />;

  return (
    <section>
      <h1>Vender</h1>

      <h2>Productos</h2>
      <ul>
        {lineas.map((linea) => {
          const cantidad = cantidades[linea.id] ?? 0;
          return (
            <li key={linea.id} aria-label={linea.nombre}>
              <span>{linea.nombre}</span> <span>{formatearPesos(linea.precio)}</span>
              <button type="button" onClick={() => cambiarCantidad(linea.id, -1)}>−</button>
              <span>{cantidad}</span>
              <button type="button" onClick={() => cambiarCantidad(linea.id, 1)}>+</button>
              <span>{formatearPesos(linea.precio * cantidad)}</span>
            </li>
          );
        })}
      </ul>

      {descuentos.length > 0 && (
        <>
          <h2>Descuentos</h2>
          {descuentos.map((d) => (
            <label key={d.id}>
              <input
                type="radio"
                name="descuento"
                checked={descuentoId === d.id}
                onChange={() => setDescuentoId(descuentoId === d.id ? null : d.id)}
              />
              {d.nombre}
            </label>
          ))}
        </>
      )}

      <h2>Método de pago</h2>
      {metodos.map((m) => (
        <label key={m.id}>
          <input type="radio" name="metodo" checked={metodoId === m.id} onChange={() => setMetodoId(m.id)} />
          {m.nombre}
        </label>
      ))}

      <h2>Cobro</h2>
      <p>Total: {formatearPesos(calculo.total)}</p>
      <button type="button" onClick={() => setRecibido(calculo.total)}>Pago exacto</button>
      <label>
        Recibido
        <input
          type="number"
          min={0}
          step={1}
          value={recibido || ""}
          onChange={(e) => setRecibido(Math.max(0, Math.trunc(Number(e.target.value))))}
        />
      </label>
      <p>Cambio: {formatearPesos(calculo.cambio)}</p>

      <button type="button" onClick={registrar} disabled={calculo.total <= 0}>Registrar venta</button>
    </section>
  );
}
```

- [ ] **Step 4: Añadir la ruta** en `router.tsx`, dentro del bloque `RutaProtegida`:

```tsx
<Route path="/eventos/:id/vender" element={<Vender />} />
```

(importa `Vender` arriba).

- [ ] **Step 5: Correr pruebas y typecheck** — PASS y limpio.

- [ ] **Step 6: Commit**

```powershell
git add Frontend/src Frontend/test/vender.test.tsx
git commit -m "feat(frontend): pantalla de venta con calculadora y cola local"
```

---

### Task 10: Pantalla de Panel

Muestra la barra de progreso hacia la meta (sobre ventas brutas) y el acumulado por método, visibles para todos. Comisiones y neto solo si el rol es `ADMIN` (el backend ya los omite al vendedor; la UI ni los pinta). Avisa cuántas ventas hay sin sincronizar sumando las de este dispositivo.

**Files:**
- Create: `Frontend/src/pantallas/Panel.tsx`, `Frontend/src/componentes/BarraMeta.tsx`
- Modify: `Frontend/src/router.tsx` (ruta `/eventos/:id/panel`)
- Test: `Frontend/test/panel.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`cliente`, `usuario`), `crearApiVentas` (`totales`), `crearCola` (`contarPendientes`), `formatearPesos`, tipo `TotalesEvento`.
- Produces: `Panel` (pantalla); `BarraMeta` (`{ bruto: number; meta: number }` → barra con `role="progressbar"`).

- [ ] **Step 1: Escribir la prueba**

`Frontend/test/panel.test.tsx`:

```tsx
import "fake-indexeddb/auto";
import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Panel } from "../src/pantallas/Panel";
import { db } from "../src/db/base";

const BASE = "http://localhost:3000";

beforeEach(async () => {
  localStorage.clear();
  await db.ventasPendientes.clear();
});

function pintar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/eventos/e1/panel"]}>
        <Routes>
          <Route path="/eventos/:id/panel" element={<Panel />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

it("muestra bruto y meta; el vendedor no ve comisiones", async () => {
  servidorMock.use(
    http.get(`${BASE}/eventos/e1/totales`, () =>
      // El backend, para un vendedor, NO manda comisiones ni neto.
      HttpResponse.json({ cantidadVentas: 3, bruto: 300000, descuentos: 0, porMetodo: [{ metodo: "Efectivo", total: 300000 }], meta: 1000000 }),
    ),
  );
  pintar();
  expect(await screen.findByText(/300\.000/)).toBeInTheDocument();
  expect(screen.queryByText(/comisiones/i)).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "300000");
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- panel` → FAIL.

- [ ] **Step 3: Escribir `BarraMeta.tsx`**

`Frontend/src/componentes/BarraMeta.tsx`:

```tsx
import { formatearPesos } from "../dinero/formato";

export function BarraMeta({ bruto, meta }: { bruto: number; meta: number }) {
  const porcentaje = meta > 0 ? Math.min(100, Math.round((bruto / meta) * 100)) : 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={bruto}
        aria-label="Progreso hacia la meta"
      >
        <div style={{ width: `${porcentaje}%`, height: "1rem", background: "currentColor" }} />
      </div>
      <p>
        {formatearPesos(bruto)} de {formatearPesos(meta)} ({porcentaje}%)
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Escribir `Panel.tsx`**

`Frontend/src/pantallas/Panel.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiVentas } from "../api/ventas";
import { crearCola } from "../sync/cola";
import { formatearPesos } from "../dinero/formato";
import type { TotalesEvento } from "../api/tipos";
import { BarraMeta } from "../componentes/BarraMeta";
import { Cargando } from "../componentes/Cargando";

export function Panel() {
  const { id: eventoId = "" } = useParams();
  const { cliente, usuario } = useAuth();
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);
  const cola = useMemo(() => crearCola(apiVentas), [apiVentas]);
  const [totales, setTotales] = useState<TotalesEvento | null>(null);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    apiVentas.totales(eventoId).then(setTotales).catch(() => setTotales(null));
    cola.contarPendientes().then(setPendientes);
  }, [apiVentas, cola, eventoId]);

  if (!totales) return <Cargando que="el panel" />;

  const esAdmin = usuario?.rol === "ADMIN";

  return (
    <section>
      <h1>Panel</h1>

      <h2>Meta</h2>
      <BarraMeta bruto={totales.bruto} meta={totales.meta} />
      {pendientes > 0 && <p role="status">{pendientes} ventas sin sincronizar</p>}

      <h2>Por método de pago</h2>
      <ul>
        {totales.porMetodo.map((m) => (
          <li key={m.metodo}>
            {m.metodo}: {formatearPesos(m.total)}
          </li>
        ))}
      </ul>

      {esAdmin && totales.comisiones !== undefined && totales.neto !== undefined && (
        <>
          <h2>Solo administración</h2>
          <p>Comisiones: {formatearPesos(totales.comisiones)}</p>
          <p>Neto tras comisiones: {formatearPesos(totales.neto)}</p>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Añadir la ruta** `/eventos/:id/panel` en `router.tsx` (dentro de `RutaProtegida`, importando `Panel`).

- [ ] **Step 6: Correr pruebas y typecheck** — PASS y limpio.

- [ ] **Step 7: Commit**

```powershell
git add Frontend/src Frontend/test/panel.test.tsx
git commit -m "feat(frontend): pantalla de panel con meta y por metodo"
```

---

### Task 11: Pantalla de Líneas del evento con candado (admin)

Arma la tabla de líneas del evento y el candado. Con el candado puesto no se editan precios; el botón lo pone y lo quita. Admin únicamente (la ruta va bajo `SoloAdmin`).

**Files:**
- Create: `Frontend/src/pantallas/Lineas.tsx`
- Modify: `Frontend/src/router.tsx` (ruta `/eventos/:id/lineas` bajo `SoloAdmin`)
- Test: `Frontend/test/lineas.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `crearApiEventos` (`buscar`, `listarLineas`, `crearLinea`, `eliminarLinea`, `cambiarCandado`), `formatearPesos`.
- Produces: `Lineas` (pantalla).

- [ ] **Step 1: Escribir la prueba**

`Frontend/test/lineas.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  expect(await screen.findByText("Pines")).toBeInTheDocument();
  // El botón de añadir está deshabilitado mientras el candado esté puesto.
  await waitFor(() => expect(screen.getByRole("button", { name: /añadir línea/i })).toBeDisabled());
  expect(screen.getByRole("button", { name: /quitar candado/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- lineas` → FAIL.

- [ ] **Step 3: Escribir `Lineas.tsx`**

`Frontend/src/pantallas/Lineas.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import { formatearPesos } from "../dinero/formato";
import type { Evento, EventoItem } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Lineas() {
  const { id: eventoId = "" } = useParams();
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiEventos(cliente), [cliente]);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [lineas, setLineas] = useState<EventoItem[]>([]);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState(0);

  async function recargar() {
    setEvento(await api.buscar(eventoId));
    setLineas(await api.listarLineas(eventoId));
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, eventoId]);

  if (!evento) return <Cargando que="las líneas" />;
  const bloqueado = evento.catalogoBloqueado;

  async function agregar() {
    if (bloqueado || !nombre || precio <= 0) return;
    await api.crearLinea(eventoId, { nombre, precio });
    setNombre("");
    setPrecio(0);
    await recargar();
  }

  async function alternarCandado() {
    await api.cambiarCandado(eventoId, !bloqueado);
    await recargar();
  }

  return (
    <section>
      <h1>Líneas del evento</h1>
      <button type="button" onClick={alternarCandado}>
        {bloqueado ? "Quitar candado" : "Poner candado"}
      </button>

      <h2>Líneas</h2>
      <ul>
        {lineas.map((l) => (
          <li key={l.id}>
            {l.nombre} — {formatearPesos(l.precio)}
            {!bloqueado && (
              <button type="button" onClick={async () => { await api.eliminarLinea(eventoId, l.id); await recargar(); }}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2>Añadir línea manual</h2>
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={bloqueado} /></label>
      <label>Precio<input type="number" min={0} step={1} value={precio || ""} onChange={(e) => setPrecio(Math.max(0, Math.trunc(Number(e.target.value))))} disabled={bloqueado} /></label>
      <button type="button" onClick={agregar} disabled={bloqueado}>Añadir línea</button>
    </section>
  );
}
```

- [ ] **Step 4: Añadir la ruta** `/eventos/:id/lineas` en `router.tsx` bajo el bloque `SoloAdmin` (importar `Lineas`).

- [ ] **Step 5: Correr pruebas y typecheck** — PASS y limpio.

- [ ] **Step 6: Commit**

```powershell
git add Frontend/src Frontend/test/lineas.test.tsx
git commit -m "feat(frontend): pantalla de lineas del evento con candado"
```

---

### Task 12: Pantalla de Catálogo (admin)

Categorías maestras del emprendimiento: listarlas, crearlas, editarlas y borrarlas. Admin únicamente.

**Files:**
- Create: `Frontend/src/api/catalogo.ts`, `Frontend/src/pantallas/Catalogo.tsx`
- Modify: `Frontend/src/router.tsx` (ruta `/catalogo` bajo `SoloAdmin`)
- Test: `Frontend/test/catalogo.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `formatearPesos`, tipos `Categoria`, `MetodoPago`.
- Produces:
  - `crearApiCatalogo(cliente)` con `listarCategorias()`, `crearCategoria(cuerpo)`, `actualizarCategoria(id, cuerpo)`, `eliminarCategoria(id)`, `listarMetodos()`, `crearMetodo(cuerpo)`, `preajusteBold()`.
  - `Catalogo` (pantalla).

- [ ] **Step 1: Escribir la prueba**

`Frontend/test/catalogo.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Catalogo } from "../src/pantallas/Catalogo";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("lista y crea una categoría", async () => {
  const categorias = [{ id: "c1", nombre: "Pines", precio: 12000 }];
  servidorMock.use(
    http.get(`${BASE}/catalogo/categorias`, () => HttpResponse.json(categorias)),
    http.post(`${BASE}/catalogo/categorias`, async ({ request }) => {
      const cuerpo = (await request.json()) as { nombre: string; precio: number };
      const nueva = { id: "c2", ...cuerpo };
      categorias.push(nueva);
      return HttpResponse.json(nueva, { status: 201 });
    }),
  );
  render(
    <AuthProvider>
      <MemoryRouter>
        <Catalogo />
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(await screen.findByText("Pines")).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/nombre/i), "Llaveros");
  await userEvent.type(screen.getByLabelText(/precio/i), "16000");
  await userEvent.click(screen.getByRole("button", { name: /agregar categoría/i }));

  await waitFor(() => expect(screen.getByText("Llaveros")).toBeInTheDocument());
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- catalogo` → FAIL.

- [ ] **Step 3: Escribir `api/catalogo.ts`**

`Frontend/src/api/catalogo.ts`:

```ts
import type { Cliente } from "./cliente";
import type { Categoria, MetodoPago } from "./tipos";

export function crearApiCatalogo(cliente: Cliente) {
  return {
    listarCategorias: () => cliente.pedir<Categoria[]>("/catalogo/categorias"),
    crearCategoria: (cuerpo: { nombre: string; precio: number }) =>
      cliente.pedir<Categoria>("/catalogo/categorias", { method: "POST", body: JSON.stringify(cuerpo) }),
    actualizarCategoria: (id: string, cuerpo: { nombre: string; precio: number }) =>
      cliente.pedir<Categoria>(`/catalogo/categorias/${id}`, { method: "PUT", body: JSON.stringify(cuerpo) }),
    eliminarCategoria: (id: string) =>
      cliente.pedir<void>(`/catalogo/categorias/${id}`, { method: "DELETE" }),
    listarMetodos: () => cliente.pedir<MetodoPago[]>("/catalogo/metodos-pago"),
    crearMetodo: (cuerpo: { nombre: string; comisionPct: number; activo: boolean }) =>
      cliente.pedir<MetodoPago>("/catalogo/metodos-pago", { method: "POST", body: JSON.stringify(cuerpo) }),
    preajusteBold: () =>
      cliente.pedir<MetodoPago[]>("/catalogo/metodos-pago/preajuste-bold", { method: "POST", body: JSON.stringify({}) }),
  };
}

export type ApiCatalogo = ReturnType<typeof crearApiCatalogo>;
```

- [ ] **Step 4: Escribir `Catalogo.tsx`**

`Frontend/src/pantallas/Catalogo.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { crearApiCatalogo } from "../api/catalogo";
import { formatearPesos } from "../dinero/formato";
import type { Categoria } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Catalogo() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState(0);

  async function recargar() {
    setCategorias(await api.listarCategorias());
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  if (!categorias) return <Cargando que="el catálogo" />;

  async function agregar() {
    if (!nombre || precio <= 0) return;
    await api.crearCategoria({ nombre, precio });
    setNombre("");
    setPrecio(0);
    await recargar();
  }

  return (
    <section>
      <h1>Catálogo</h1>

      <h2>Categorías</h2>
      <ul>
        {categorias.map((c) => (
          <li key={c.id}>
            {c.nombre} — {formatearPesos(c.precio)}
            <button type="button" onClick={async () => { await api.eliminarCategoria(c.id); await recargar(); }}>Borrar</button>
          </li>
        ))}
      </ul>

      <h2>Agregar categoría</h2>
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Precio<input type="number" min={0} step={1} value={precio || ""} onChange={(e) => setPrecio(Math.max(0, Math.trunc(Number(e.target.value))))} /></label>
      <button type="button" onClick={agregar}>Agregar categoría</button>
    </section>
  );
}
```

- [ ] **Step 5: Añadir la ruta** `/catalogo` bajo `SoloAdmin` (importar `Catalogo`).

- [ ] **Step 6: Correr pruebas y typecheck** — PASS y limpio.

- [ ] **Step 7: Commit**

```powershell
git add Frontend/src Frontend/test/catalogo.test.tsx
git commit -m "feat(frontend): pantalla de catalogo de categorias"
```

---

### Task 13: Pantalla de Configuración — métodos de pago y preajuste Bold (admin)

Completa el marcador de `Configuracion`. Lista los métodos de pago, deja crear uno y aplicar el preajuste de Bold de un toque. El código de comisión que se envía es en **puntos básicos**: el formulario pide el porcentaje y lo convierte (1,5 → 150). El vendedor nunca ve esta pantalla.

**Files:**
- Modify: `Frontend/src/pantallas/Configuracion.tsx`
- Test: `Frontend/test/configuracion.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `crearApiCatalogo` (`listarMetodos`, `crearMetodo`, `preajusteBold`).
- Produces: `Configuracion` (pantalla completa).

- [ ] **Step 1: Escribir la prueba**

`Frontend/test/configuracion.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { servidorMock } from "./servidor-mock";
import { AuthProvider } from "../src/auth/AuthContext";
import { Configuracion } from "../src/pantallas/Configuracion";

const BASE = "http://localhost:3000";
beforeEach(() => localStorage.clear());

it("aplica el preajuste de Bold y muestra los tres métodos", async () => {
  let metodos: Array<{ id: string; nombre: string; comisionPct: number; activo: boolean }> = [];
  servidorMock.use(
    http.get(`${BASE}/catalogo/metodos-pago`, () => HttpResponse.json(metodos)),
    http.post(`${BASE}/catalogo/metodos-pago/preajuste-bold`, () => {
      metodos = [
        { id: "m1", nombre: "Efectivo", comisionPct: 0, activo: true },
        { id: "m2", nombre: "QR", comisionPct: 150, activo: true },
        { id: "m3", nombre: "Datáfono", comisionPct: 500, activo: true },
      ];
      return HttpResponse.json(metodos, { status: 201 });
    }),
  );
  render(
    <AuthProvider>
      <MemoryRouter>
        <Configuracion />
      </MemoryRouter>
    </AuthProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /preajuste de bold/i }));
  await waitFor(() => expect(screen.getByText("Datáfono")).toBeInTheDocument());
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- configuracion` → FAIL.

- [ ] **Step 3: Escribir `Configuracion.tsx`**

`Frontend/src/pantallas/Configuracion.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { crearApiCatalogo } from "../api/catalogo";
import type { MetodoPago } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Configuracion() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const [metodos, setMetodos] = useState<MetodoPago[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState(0); // en % (1,5), se convierte a puntos básicos

  async function recargar() {
    setMetodos(await api.listarMetodos());
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  if (!metodos) return <Cargando que="la configuración" />;

  async function agregar() {
    if (!nombre) return;
    // El backend guarda la comisión en puntos básicos enteros: 1,5 % -> 150.
    const comisionPct = Math.round(porcentaje * 100);
    await api.crearMetodo({ nombre, comisionPct, activo: true });
    setNombre("");
    setPorcentaje(0);
    await recargar();
  }

  async function aplicarBold() {
    await api.preajusteBold();
    await recargar();
  }

  return (
    <section>
      <h1>Configuración</h1>

      <h2>Métodos de pago</h2>
      <ul>
        {metodos.map((m) => (
          <li key={m.id}>{m.nombre}</li>
        ))}
      </ul>

      <button type="button" onClick={aplicarBold}>Aplicar preajuste de Bold</button>

      <h2>Agregar método</h2>
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Comisión (%)<input type="number" min={0} step={0.1} value={porcentaje || ""} onChange={(e) => setPorcentaje(Math.max(0, Number(e.target.value)))} /></label>
      <button type="button" onClick={agregar}>Agregar método</button>
    </section>
  );
}
```

- [ ] **Step 4: Correr pruebas y typecheck** — PASS y limpio.

- [ ] **Step 5: Commit**

```powershell
git add Frontend/src/pantallas/Configuracion.tsx Frontend/test/configuracion.test.tsx
git commit -m "feat(frontend): configuracion de metodos de pago y preajuste Bold"
```

---

### Task 14: PWA instalable, navegación del shell y despliegue

Convierte la app en PWA instalable (manifest + service worker que cachea el shell), añade la barra de navegación con el nombre del usuario y "Salir", y deja lista la configuración de Vercel. El service worker se registra solo en producción para no estorbar en las pruebas.

**Files:**
- Modify: `Frontend/vite.config.ts` (plugin PWA)
- Create: `Frontend/src/componentes/Navegacion.tsx`
- Modify: `Frontend/src/router.tsx` (envolver rutas protegidas en un layout con navegación)
- Create: `Frontend/vercel.json`, `Frontend/.env.production`
- Create iconos: `Frontend/public/icon-192.png`, `Frontend/public/icon-512.png`
- Test: `Frontend/test/navegacion.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`usuario`, `salir`).
- Produces: `Navegacion` (barra con enlaces según rol y botón salir); `Layout` (envuelve `<Outlet/>` con la navegación).

- [ ] **Step 1: Escribir la prueba de navegación**

`Frontend/test/navegacion.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Navegacion } from "../src/componentes/Navegacion";

it("el vendedor no ve enlaces de administración", () => {
  render(
    <MemoryRouter>
      <Navegacion usuario={{ id: "u1", email: "v@v.co", nombre: "Vale", rol: "VENDEDOR", emprendimientoId: "e1" }} salir={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByText(/vale/i)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /catálogo/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /salir/i })).toBeInTheDocument();
});

it("el admin ve los enlaces de administración", () => {
  render(
    <MemoryRouter>
      <Navegacion usuario={{ id: "u1", email: "a@a.co", nombre: "Ana", rol: "ADMIN", emprendimientoId: "e1" }} salir={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /catálogo/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /configuración/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr y ver fallar** — Run: `npm test -- navegacion` → FAIL.

- [ ] **Step 3: Escribir `Navegacion.tsx`**

`Frontend/src/componentes/Navegacion.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { Usuario } from "../api/tipos";

export function Navegacion({ usuario, salir }: { usuario: Usuario; salir: () => void }) {
  return (
    <nav>
      <Link to="/eventos">Eventos</Link>
      {usuario.rol === "ADMIN" && (
        <>
          <Link to="/catalogo">Catálogo</Link>
          <Link to="/configuracion">Configuración</Link>
        </>
      )}
      <span>{usuario.nombre}</span>
      <button type="button" onClick={salir}>Salir</button>
    </nav>
  );
}
```

- [ ] **Step 4: Añadir un `Layout` con navegación** en `router.tsx`: un componente que use `useAuth` y renderice `<Navegacion/>` + `<Outlet/>`, y envolver con él las rutas de dentro de `RutaProtegida`.

```tsx
import { Outlet } from "react-router-dom";
import { Navegacion } from "./componentes/Navegacion";
import { useAuth } from "./auth/AuthContext";

function Layout() {
  const { usuario, salir } = useAuth();
  return (
    <>
      {usuario && <Navegacion usuario={usuario} salir={salir} />}
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

En `<Routes>`, anida el `Layout` justo dentro de `RutaProtegida`:

```tsx
<Route element={<RutaProtegida />}>
  <Route element={<Layout />}>
    {/* eventos, vender, panel, y el bloque SoloAdmin con lineas, catalogo, configuracion */}
  </Route>
</Route>
```

- [ ] **Step 5: Correr la prueba de navegación** — PASS.

- [ ] **Step 6: Configurar la PWA en `vite.config.ts`**

Añade el plugin. `registerType: "autoUpdate"`, `disable` en modo test para no registrar el SW en jsdom:

```ts
import { VitePWA } from "vite-plugin-pwa";

// dentro de plugins:
VitePWA({
  registerType: "autoUpdate",
  disable: process.env.NODE_ENV === "test",
  includeAssets: ["icon-192.png", "icon-512.png"],
  manifest: {
    name: "Dodoco Store",
    short_name: "Dodoco",
    description: "Registro de ventas para ferias",
    theme_color: "#111111",
    background_color: "#ffffff",
    display: "standalone",
    start_url: "/",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
}),
```

Crea los iconos: copia `logo.png` de la raíz del repo y genera dos PNG cuadrados de 192 y 512 px en `Frontend/public/` (con cualquier herramienta de imagen; deben existir con esos nombres para que el build no falle).

- [ ] **Step 7: Configurar el despliegue en Vercel**

`Frontend/.env.production` (ajusta la URL real de Railway cuando esté):

```
VITE_API_URL=https://TU-BACKEND.up.railway.app
```

`Frontend/vercel.json` (SPA: toda ruta cae en `index.html`):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 8: Verificar el build de producción**

Run: `npm run build`
Expected: compila sin errores y genera `dist/` con `manifest.webmanifest` y el service worker. Confirma que **no** hay archivos `.map` en `dist/` (sourcemaps apagados).

- [ ] **Step 9: Correr toda la suite y typecheck**

Run: `npm test` → PASS.
Run: `npm run typecheck` → limpio.

- [ ] **Step 10: Commit**

```powershell
git add Frontend
git commit -m "feat(frontend): PWA instalable, navegacion y despliegue en Vercel"
```

---

## Verificación final del plan

Al terminar las 14 tareas, recorrer esta lista:

- [ ] `npm test` en `Frontend/` pasa completo.
- [ ] `npm run typecheck` sin errores; `npm run build` compila.
- [ ] No hay `.map` en `dist/` (sin sourcemaps en producción).
- [ ] Ningún archivo de `pantallas/` llama `fetch` directo: todo pasa por `api/`.
- [ ] El vendedor no ve comisiones ni neto en el panel, ni enlaces de administración en la navegación, ni puede entrar a `/catalogo`, `/configuracion` ni `/eventos/:id/lineas` (guarda `SoloAdmin`).
- [ ] Una venta registrada sin red queda en IndexedDB como `pendiente` y el panel avisa "N ventas sin sincronizar".
- [ ] La app es instalable (manifest + service worker) y arranca el shell sin conexión.
- [ ] Todos los montos que se envían al backend son enteros; los porcentajes, puntos básicos.

## Self-Review (hecho al escribir el plan)

**Cobertura del spec:** login/registro (T7), eventos (T8), vender con pago exacto y cambio (T9), panel con meta y por método y bloque admin (T10), líneas+candado (T11), catálogo (T12), configuración con preajuste Bold (T13), PWA offline + sync (T5, T14). Comisión oculta al vendedor: T9 (no se muestra en venta) y T10 (backend la omite, UI no la pinta). Sin sourcemaps y jerarquía h1/h2/h3: en cada pantalla. Idempotencia por uuid: T5. Local-first con cola: T5, T9.

**Huecos conocidos, aceptados para esta fase:**
- No hay reintento automático en segundo plano con temporizador: la cola se dispara al registrar y al abrir el panel. Un reintento periódico o por evento `online` se puede añadir en T14 si se quiere, pero el spec pide "cola que envía en segundo plano", que estas tareas cumplen al registrar y al entrar al panel. **Mejora sugerida (no bloqueante):** en T14, registrar un listener `window.addEventListener("online", () => cola.sincronizar())`.
- El aviso de "sin almacenamiento (incógnito)" del spec (§10) no tiene tarea propia; Dexie lanzará al abrir en modo incógnito con IndexedDB deshabilitado. Añadir un `try/catch` con aviso visible es una mejora menor para una tarea futura.
- La pantalla de vender recarga métodos/ líneas/ descuentos del servidor al entrar; sin red la primera vez, no habrá catálogo. Cachear el catálogo del evento en IndexedDB (como los totales) es la evolución natural si se quiere abrir un evento nuevo estando sin señal; para un evento ya abierto una vez, se resuelve al cachear. Anotado como deuda para la Fase 2.

