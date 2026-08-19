# Fase 1 · Plan 2 — Dominio de ventas en el backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el backend sepa de ferias: catálogo, métodos de pago con comisión, eventos con su tabla de líneas y candado, descuentos, y el registro de ventas idempotente con sus totales.

**Architecture:** Se extiende el backend del Plan 1 sin cambiar sus capas: `routes → controllers → services → repositories → Prisma → MySQL`. La capa de repositorios sigue siendo el único punto que toca la base y exige siempre `emprendimientoId`. La aritmética del dinero vive en un servicio puro y sin base de datos, para poder probarla exhaustivamente. La idempotencia de las ventas se apoya en una restricción única sobre `Venta.uuid`, no en comprobaciones previas que podrían perder una carrera.

**Tech Stack:** El del Plan 1, sin dependencias nuevas: Node 20+, TypeScript, Express 5, Prisma 6, MySQL 8, Vitest, Supertest, Zod 4.

## Global Constraints

- Todo el código en **TypeScript estricto** (`strict: true`). Sin `any` implícito.
- **El dinero se guarda y se calcula como entero de pesos.** Nunca `Float` ni `Decimal` para montos. Todo redondeo es `Math.round` a peso entero. En COP no se usan centavos y los flotantes producen errores de un peso justo al cuadrar caja.
- **Ningún archivo fuera de `src/repositories/` importa `PrismaClient` ni consulta la base de datos.** Los controladores nunca consultan; usan servicios o repositorios.
- **Toda función de repositorio que lea o escriba datos de un emprendimiento recibe `scope: Scope` como primer parámetro.** Ya existen **dos excepciones documentadas**, ambas en `usuario.repository.ts` y con sufijo `Global`: `buscarPorEmailGlobal` y `buscarPorIdGlobal`. **Este plan no puede añadir ninguna excepción más.**
- **La venta guarda fotos del momento, no referencias.** Almacena nombre, precio unitario, porcentaje de descuento y porcentaje de comisión tal como estaban al vender. Cambiar un precio o una tarifa después no debe reescribir el pasado.
- **`Venta.uuid` es único y lo genera el dispositivo.** Es la llave de idempotencia: reintentar un envío nunca duplica una venta.
- **`emprendimientoId` está en todas las tablas nuevas**, incluso donde sería deducible por una relación, para que el filtro de la capa de repositorios sea directo y auditable.
- Mensajes de error **en español**, sin filtrar detalles internos.
- Identificadores **UUID en texto generados por la aplicación** (`randomUUID()`), nunca por la base de datos.
- El backend es **ESM** (`"type": "module"`): los imports internos llevan extensión `.js` aunque el fuente sea `.ts`. No es un error de tipeo.
- Versiones fijadas: **Prisma `^6.19.3`**, **Zod `^4`**, **`zod-openapi` `^5`**. No subirlas.
- **La comisión no se le muestra al vendedor.** Los endpoints que devuelven comisión o neto son solo para `ADMIN`; el vendedor ve el total que cobra el cliente.
- **La prueba de `/docs.json` en `test/docs.test.ts` compara los paths con una lista cerrada.** Toda tarea que añada un endpoint al documento OpenAPI debe actualizar esa lista o la suite romperá.

---

### Task 1: Esquema del dominio y migración

**Files:**
- Modify: `Backend/prisma/schema.prisma`
- Modify: `Backend/test/helpers/db.ts`
- Test: `Backend/test/esquema-dominio.test.ts`

**Interfaces:**
- Consumes: `prisma` de `src/infra/prisma.js`; `limpiarBaseDeDatos()` de `test/helpers/db.js`.
- Produces: los modelos `Categoria`, `Producto`, `MetodoPago`, `Evento`, `EventoItem`, `Descuento`, `Venta`, `VentaItem`. Todas las tareas siguientes escriben contra ellos.

- [ ] **Step 1: Ampliar el esquema**

Añadir a `Backend/prisma/schema.prisma` (después de los modelos existentes):

```prisma
enum OrigenItem {
  CATEGORIA
  PRODUCTO
  MANUAL
}

enum EstadoEvento {
  ACTIVO
  CERRADO
}

model Categoria {
  id               String     @id
  nombre           String
  precio           Int
  emprendimientoId String
  creadaEn         DateTime   @default(now())
  productos        Producto[]

  @@index([emprendimientoId])
}

model Producto {
  id               String    @id
  nombre           String
  precioSugerido   Int
  categoriaId      String
  categoria        Categoria @relation(fields: [categoriaId], references: [id], onDelete: Cascade)
  emprendimientoId String
  creadoEn         DateTime  @default(now())

  @@index([emprendimientoId])
  @@index([categoriaId])
}

model MetodoPago {
  id               String   @id
  nombre           String
  comisionPct      Int
  activo           Boolean  @default(true)
  emprendimientoId String
  creadoEn         DateTime @default(now())

  @@index([emprendimientoId])
}

model Evento {
  id                 String       @id
  nombre             String
  fechaInicio        DateTime
  fechaFin           DateTime?
  meta               Int
  catalogoBloqueado  Boolean      @default(false)
  estado             EstadoEvento @default(ACTIVO)
  emprendimientoId   String
  creadoEn           DateTime     @default(now())
  lineas             EventoItem[]
  descuentos         Descuento[]
  ventas             Venta[]

  @@index([emprendimientoId])
}

model EventoItem {
  id               String     @id
  nombre           String
  precio           Int
  origenTipo       OrigenItem
  origenId         String?
  eventoId         String
  evento           Evento     @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  emprendimientoId String
  creadoEn         DateTime   @default(now())

  @@index([emprendimientoId])
  @@index([eventoId])
}

model Descuento {
  id               String   @id
  nombre           String
  porcentaje       Int
  activo           Boolean  @default(true)
  eventoId         String
  evento           Evento   @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  emprendimientoId String
  creadoEn         DateTime @default(now())

  @@index([emprendimientoId])
  @@index([eventoId])
}

model Venta {
  id                   String      @id
  uuid                 String      @unique
  eventoId             String
  evento               Evento      @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  usuarioId            String
  subtotal             Int
  descuentoNombre      String?
  descuentoPct         Int         @default(0)
  descuentoValor       Int         @default(0)
  total                Int
  metodoPagoNombre     String
  comisionPct          Int         @default(0)
  comisionValor        Int         @default(0)
  neto                 Int
  recibido             Int         @default(0)
  cambio               Int         @default(0)
  creadaEnDispositivo  DateTime
  recibidaEnServidor   DateTime    @default(now())
  emprendimientoId     String
  items                VentaItem[]

  @@index([emprendimientoId])
  @@index([eventoId])
}

model VentaItem {
  id               String   @id
  nombre           String
  precioUnitario   Int
  cantidad         Int
  subtotal         Int
  ventaId          String
  venta            Venta    @relation(fields: [ventaId], references: [id], onDelete: Cascade)
  emprendimientoId String

  @@index([emprendimientoId])
  @@index([ventaId])
}
```

Nota sobre los porcentajes: `comisionPct`, `descuentoPct` y `porcentaje` se guardan como **enteros en puntos básicos** (centésimas de porcentaje), no como decimales. El 1,5 % de Bold es `150`; el 5 % del datáfono es `500`; el 10 % de descuento es `1000`. Así el esquema respeta la regla de que nunca hay flotantes, y la conversión vive en un solo sitio (Task 5).

- [ ] **Step 2: Crear la migración**

Run: `npx prisma migrate dev --name dominio-ventas`
Expected: crea la migración y regenera el cliente de Prisma.

- [ ] **Step 3: Actualizar el limpiador de la base**

`Backend/test/helpers/db.ts` — el orden importa: los hijos antes que los padres, o las llaves foráneas fallan.

```ts
import { prisma } from "../../src/infra/prisma.js";

export async function limpiarBaseDeDatos(): Promise<void> {
  await prisma.ventaItem.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.descuento.deleteMany();
  await prisma.eventoItem.deleteMany();
  await prisma.evento.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.metodoPago.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.emprendimiento.deleteMany();
}
```

- [ ] **Step 4: Escribir la prueba que falla**

`Backend/test/esquema-dominio.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";

const EMP = "emp-dominio";

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.create({
    data: { id: EMP, nombre: "Dodoco Store" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("esquema del dominio de ventas", () => {
  it("rechaza dos ventas con el mismo uuid", async () => {
    const evento = await prisma.evento.create({
      data: {
        id: randomUUID(),
        nombre: "Feria de prueba",
        fechaInicio: new Date(),
        meta: 1000000,
        emprendimientoId: EMP,
      },
    });

    const venta = (uuid: string) => ({
      id: randomUUID(),
      uuid,
      eventoId: evento.id,
      usuarioId: "u1",
      subtotal: 12000,
      total: 12000,
      metodoPagoNombre: "Efectivo",
      neto: 12000,
      creadaEnDispositivo: new Date(),
      emprendimientoId: EMP,
    });

    const mismoUuid = "uuid-repetido";
    await prisma.venta.create({ data: venta(mismoUuid) });

    await expect(prisma.venta.create({ data: venta(mismoUuid) })).rejects.toThrow();
  });

  it("borra las líneas y las ventas al borrar el evento", async () => {
    const evento = await prisma.evento.create({
      data: {
        id: randomUUID(),
        nombre: "Feria efímera",
        fechaInicio: new Date(),
        meta: 500000,
        emprendimientoId: EMP,
        lineas: {
          create: {
            id: randomUUID(),
            nombre: "Pines",
            precio: 12000,
            origenTipo: "CATEGORIA",
            emprendimientoId: EMP,
          },
        },
      },
    });

    await prisma.evento.delete({ where: { id: evento.id } });

    expect(await prisma.eventoItem.count()).toBe(0);
  });

  it("guarda el dinero como entero y el evento arranca desbloqueado y activo", async () => {
    const evento = await prisma.evento.create({
      data: {
        id: randomUUID(),
        nombre: "Feria",
        fechaInicio: new Date(),
        meta: 1000000,
        emprendimientoId: EMP,
      },
    });

    expect(Number.isInteger(evento.meta)).toBe(true);
    expect(evento.catalogoBloqueado).toBe(false);
    expect(evento.estado).toBe("ACTIVO");
  });
});
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — las 3 pruebas nuevas más las 40 previas.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): esquema del dominio de ventas"
```

---

### Task 2: Repositorio de catálogo con aislamiento

**Files:**
- Create: `Backend/src/repositories/catalogo.repository.ts`
- Test: `Backend/test/catalogo.repository.test.ts`

**Interfaces:**
- Consumes: `prisma`, `Scope` de `src/repositories/scope.js`.
- Produces: `catalogoRepository` con `listarCategorias(scope)`, `crearCategoria(scope, datos)`, `actualizarCategoria(scope, id, datos)`, `eliminarCategoria(scope, id)`, `listarProductos(scope, categoriaId)`, `crearProducto(scope, datos)`. Tipos `Categoria`, `NuevaCategoria`, `Producto`, `NuevoProducto` exportados desde el mismo archivo.

- [ ] **Step 1: Escribir la prueba de fuga que falla**

`Backend/test/catalogo.repository.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { catalogoRepository } from "../src/repositories/catalogo.repository.js";

const A = "emp-a";
const B = "emp-b";

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.createMany({
    data: [
      { id: A, nombre: "Dodoco" },
      { id: B, nombre: "Medias Pao" },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("catálogo con aislamiento", () => {
  it("solo lista las categorías del emprendimiento del scope", async () => {
    await catalogoRepository.crearCategoria({ emprendimientoId: A }, { nombre: "Pines", precio: 12000 });
    await catalogoRepository.crearCategoria({ emprendimientoId: B }, { nombre: "Medias", precio: 15000 });

    const deA = await catalogoRepository.listarCategorias({ emprendimientoId: A });

    expect(deA).toHaveLength(1);
    expect(deA[0].nombre).toBe("Pines");
  });

  it("no deja actualizar una categoría de otro emprendimiento aunque se sepa su id", async () => {
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    const resultado = await catalogoRepository.actualizarCategoria(
      { emprendimientoId: A },
      ajena.id,
      { nombre: "Robada", precio: 1 },
    );

    expect(resultado).toBeNull();

    const sigueIgual = await prisma.categoria.findUnique({ where: { id: ajena.id } });
    expect(sigueIgual?.nombre).toBe("Medias");
    expect(sigueIgual?.precio).toBe(15000);
  });

  it("no deja eliminar una categoría de otro emprendimiento", async () => {
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    const borradas = await catalogoRepository.eliminarCategoria({ emprendimientoId: A }, ajena.id);

    expect(borradas).toBe(false);
    expect(await prisma.categoria.count()).toBe(1);
  });

  it("no deja colgar un producto de una categoría de otro emprendimiento", async () => {
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    const producto = await catalogoRepository.crearProducto(
      { emprendimientoId: A },
      { nombre: "Media rayada", precioSugerido: 15000, categoriaId: ajena.id },
    );

    expect(producto).toBeNull();
    expect(await prisma.producto.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- catalogo.repository`
Expected: FAIL — no existe el módulo del repositorio.

- [ ] **Step 3: Implementar**

`Backend/src/repositories/catalogo.repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type Categoria = {
  id: string;
  nombre: string;
  precio: number;
};

export type NuevaCategoria = {
  nombre: string;
  precio: number;
};

export type Producto = {
  id: string;
  nombre: string;
  precioSugerido: number;
  categoriaId: string;
};

export type NuevoProducto = {
  nombre: string;
  precioSugerido: number;
  categoriaId: string;
};

const camposCategoria = { id: true, nombre: true, precio: true } as const;
const camposProducto = {
  id: true,
  nombre: true,
  precioSugerido: true,
  categoriaId: true,
} as const;

export const catalogoRepository = {
  async listarCategorias(scope: Scope): Promise<Categoria[]> {
    return prisma.categoria.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: camposCategoria,
      orderBy: { creadaEn: "asc" },
    });
  },

  async crearCategoria(scope: Scope, datos: NuevaCategoria): Promise<Categoria> {
    return prisma.categoria.create({
      // El spread va primero: ni el id ni el emprendimiento pueden sobrescribirse.
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposCategoria,
    });
  },

  /** Devuelve `null` si la categoría no es de este emprendimiento. */
  async actualizarCategoria(
    scope: Scope,
    id: string,
    datos: NuevaCategoria,
  ): Promise<Categoria | null> {
    const { count } = await prisma.categoria.updateMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
      data: datos,
    });

    if (count === 0) return null;

    return prisma.categoria.findUniqueOrThrow({
      where: { id },
      select: camposCategoria,
    });
  },

  /** Devuelve `false` si la categoría no es de este emprendimiento. */
  async eliminarCategoria(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.categoria.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });

    return count === 1;
  },

  async listarProductos(scope: Scope, categoriaId: string): Promise<Producto[]> {
    return prisma.producto.findMany({
      where: { emprendimientoId: scope.emprendimientoId, categoriaId },
      select: camposProducto,
      orderBy: { creadoEn: "asc" },
    });
  },

  /** Devuelve `null` si la categoría indicada no es de este emprendimiento. */
  async crearProducto(scope: Scope, datos: NuevoProducto): Promise<Producto | null> {
    const categoria = await prisma.categoria.findFirst({
      where: { id: datos.categoriaId, emprendimientoId: scope.emprendimientoId },
      select: { id: true },
    });

    if (!categoria) return null;

    return prisma.producto.create({
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposProducto,
    });
  },
};
```

Nota: `updateMany` y `deleteMany` se usan en vez de `update`/`delete` a propósito. Son las únicas variantes que aceptan un `where` compuesto, así que permiten exigir el `emprendimientoId` en la misma operación. Con `update({ where: { id } })` habría que consultar antes para comprobar el dueño, y entre esa consulta y la escritura cabe una carrera.

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 4 pruebas nuevas de aislamiento del catálogo.

- [ ] **Step 5: Commit**

```bash
git add Backend
git commit -m "feat(backend): repositorio de catalogo con aislamiento"
```

---

### Task 3: Métodos de pago y preajuste de Bold

**Files:**
- Create: `Backend/src/repositories/metodoPago.repository.ts`
- Create: `Backend/src/services/metodoPago.service.ts`
- Test: `Backend/test/metodoPago.test.ts`

**Interfaces:**
- Consumes: `prisma`, `Scope`, `ErrorDeNegocio` de `src/errors.js`.
- Produces:
  - `metodoPagoRepository` con `listar(scope)`, `crear(scope, datos)`, `actualizar(scope, id, datos)`, `eliminar(scope, id)`, `contar(scope)`.
  - `metodoPagoService.aplicarPreajusteBold(scope)` que crea los tres métodos estándar y devuelve la lista.
  - `PRESET_BOLD`, arreglo exportado con los tres métodos y sus comisiones en puntos básicos.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/metodoPago.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { metodoPagoRepository } from "../src/repositories/metodoPago.repository.js";
import { metodoPagoService, PRESET_BOLD } from "../src/services/metodoPago.service.js";

const A = "emp-a";
const B = "emp-b";

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.createMany({
    data: [
      { id: A, nombre: "Dodoco" },
      { id: B, nombre: "Medias Pao" },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("métodos de pago", () => {
  it("el preajuste de Bold crea efectivo, QR y datáfono con sus comisiones", async () => {
    const metodos = await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });

    expect(metodos).toHaveLength(3);
    expect(metodos.map((m) => [m.nombre, m.comisionPct])).toEqual([
      ["Efectivo", 0],
      ["QR", 150],
      ["Datáfono", 500],
    ]);
  });

  it("las comisiones del preajuste están en puntos básicos, no en decimales", () => {
    const qr = PRESET_BOLD.find((m) => m.nombre === "QR");

    // 1,5 % son 150 puntos básicos. Un 1.5 aquí sería un flotante y rompería
    // la regla de que el dinero y sus porcentajes son siempre enteros.
    expect(qr?.comisionPct).toBe(150);
    expect(Number.isInteger(qr?.comisionPct)).toBe(true);
  });

  it("no aplica el preajuste dos veces sobre el mismo emprendimiento", async () => {
    await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });

    await expect(
      metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A }),
    ).rejects.toMatchObject({ codigo: "METODOS_YA_CONFIGURADOS" });

    expect(await metodoPagoRepository.contar({ emprendimientoId: A })).toBe(3);
  });

  it("el preajuste de un emprendimiento no aparece en el otro", async () => {
    await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });

    expect(await metodoPagoRepository.listar({ emprendimientoId: B })).toHaveLength(0);
  });

  it("no deja actualizar un método de pago de otro emprendimiento", async () => {
    const [efectivo] = await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: B });

    const resultado = await metodoPagoRepository.actualizar(
      { emprendimientoId: A },
      efectivo.id,
      { nombre: "Secuestrado", comisionPct: 9999, activo: true },
    );

    expect(resultado).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- metodoPago`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar**

`Backend/src/repositories/metodoPago.repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type MetodoPago = {
  id: string;
  nombre: string;
  comisionPct: number;
  activo: boolean;
};

export type NuevoMetodoPago = {
  nombre: string;
  comisionPct: number;
  activo: boolean;
};

const campos = { id: true, nombre: true, comisionPct: true, activo: true } as const;

export const metodoPagoRepository = {
  async listar(scope: Scope): Promise<MetodoPago[]> {
    return prisma.metodoPago.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: campos,
      orderBy: { creadoEn: "asc" },
    });
  },

  async contar(scope: Scope): Promise<number> {
    return prisma.metodoPago.count({
      where: { emprendimientoId: scope.emprendimientoId },
    });
  },

  async crear(scope: Scope, datos: NuevoMetodoPago): Promise<MetodoPago> {
    return prisma.metodoPago.create({
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: campos,
    });
  },

  async crearVarios(scope: Scope, datos: NuevoMetodoPago[]): Promise<MetodoPago[]> {
    await prisma.metodoPago.createMany({
      data: datos.map((m) => ({
        ...m,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      })),
    });

    return this.listar(scope);
  },

  /** Devuelve `null` si el método no es de este emprendimiento. */
  async actualizar(
    scope: Scope,
    id: string,
    datos: NuevoMetodoPago,
  ): Promise<MetodoPago | null> {
    const { count } = await prisma.metodoPago.updateMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
      data: datos,
    });

    if (count === 0) return null;

    return prisma.metodoPago.findUniqueOrThrow({ where: { id }, select: campos });
  },

  /** Devuelve `false` si el método no es de este emprendimiento. */
  async eliminar(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.metodoPago.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });

    return count === 1;
  },
};
```

`Backend/src/services/metodoPago.service.ts`:

```ts
import { ErrorDeNegocio } from "../errors.js";
import {
  metodoPagoRepository,
  type MetodoPago,
  type NuevoMetodoPago,
} from "../repositories/metodoPago.repository.js";
import type { Scope } from "../repositories/scope.js";

/**
 * Comisiones estándar de Bold, en puntos básicos (centésimas de porcentaje):
 * 150 son 1,5 % y 500 son 5 %. Se guardan como enteros porque el proyecto no
 * admite flotantes en nada que toque dinero.
 */
export const PRESET_BOLD: NuevoMetodoPago[] = [
  { nombre: "Efectivo", comisionPct: 0, activo: true },
  { nombre: "QR", comisionPct: 150, activo: true },
  { nombre: "Datáfono", comisionPct: 500, activo: true },
];

export const metodoPagoService = {
  async aplicarPreajusteBold(scope: Scope): Promise<MetodoPago[]> {
    const existentes = await metodoPagoRepository.contar(scope);

    if (existentes > 0) {
      throw new ErrorDeNegocio(
        "METODOS_YA_CONFIGURADOS",
        "Ya tienes métodos de pago configurados. Edítalos o bórralos antes de aplicar el preajuste.",
        409,
      );
    }

    return metodoPagoRepository.crearVarios(scope, PRESET_BOLD);
  },
};
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 5 pruebas nuevas.

- [ ] **Step 5: Commit**

```bash
git add Backend
git commit -m "feat(backend): metodos de pago con preajuste de Bold"
```

---

### Task 4: Eventos, líneas y candado

**Files:**
- Create: `Backend/src/repositories/evento.repository.ts`
- Create: `Backend/src/services/evento.service.ts`
- Test: `Backend/test/evento.test.ts`

**Interfaces:**
- Consumes: `prisma`, `Scope`, `ErrorDeNegocio`, `catalogoRepository`.
- Produces:
  - `eventoRepository` con `listar(scope)`, `crear(scope, datos)`, `buscarPorId(scope, id)`, `cambiarCandado(scope, id, bloqueado)`, `listarLineas(scope, eventoId)`, `crearLinea(scope, eventoId, datos)`, `eliminarLinea(scope, id)`, `listarDescuentos(scope, eventoId)`, `crearDescuento(scope, eventoId, datos)`.
  - `eventoService.agregarCategoriaComoLinea(scope, eventoId, categoriaId)` y `eventoService.agregarLineaManual(scope, eventoId, datos)`, ambas rechazando si el catálogo está bloqueado.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/evento.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { catalogoRepository } from "../src/repositories/catalogo.repository.js";
import { eventoRepository } from "../src/repositories/evento.repository.js";
import { eventoService } from "../src/services/evento.service.js";

const A = "emp-a";
const B = "emp-b";
const scopeA = { emprendimientoId: A };

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.createMany({
    data: [
      { id: A, nombre: "Dodoco" },
      { id: B, nombre: "Medias Pao" },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function crearEvento(emprendimientoId: string) {
  return eventoRepository.crear(
    { emprendimientoId },
    { nombre: "Feria de abril", fechaInicio: new Date(), fechaFin: null, meta: 1000000 },
  );
}

describe("eventos y líneas", () => {
  it("traer una categoría crea UNA sola línea con su nombre y precio", async () => {
    const evento = await crearEvento(A);
    const categoria = await catalogoRepository.crearCategoria(scopeA, {
      nombre: "Medias",
      precio: 15000,
    });

    const linea = await eventoService.agregarCategoriaComoLinea(scopeA, evento.id, categoria.id);

    expect(linea.nombre).toBe("Medias");
    expect(linea.precio).toBe(15000);
    expect(linea.origenTipo).toBe("CATEGORIA");

    const lineas = await eventoRepository.listarLineas(scopeA, evento.id);
    expect(lineas).toHaveLength(1);
  });

  it("la línea conserva el precio aunque después cambie el de la categoría", async () => {
    const evento = await crearEvento(A);
    const categoria = await catalogoRepository.crearCategoria(scopeA, {
      nombre: "Medias",
      precio: 15000,
    });
    await eventoService.agregarCategoriaComoLinea(scopeA, evento.id, categoria.id);

    await catalogoRepository.actualizarCategoria(scopeA, categoria.id, {
      nombre: "Medias",
      precio: 20000,
    });

    const [linea] = await eventoRepository.listarLineas(scopeA, evento.id);
    expect(linea.precio).toBe(15000);
  });

  it("con el catálogo bloqueado no se pueden añadir líneas", async () => {
    const evento = await crearEvento(A);
    await eventoRepository.cambiarCandado(scopeA, evento.id, true);

    await expect(
      eventoService.agregarLineaManual(scopeA, evento.id, {
        nombre: "Improvisado",
        precio: 5000,
      }),
    ).rejects.toMatchObject({ codigo: "CATALOGO_BLOQUEADO" });

    expect(await eventoRepository.listarLineas(scopeA, evento.id)).toHaveLength(0);
  });

  it("al quitar el candado se pueden volver a añadir líneas", async () => {
    const evento = await crearEvento(A);
    await eventoRepository.cambiarCandado(scopeA, evento.id, true);
    await eventoRepository.cambiarCandado(scopeA, evento.id, false);

    const linea = await eventoService.agregarLineaManual(scopeA, evento.id, {
      nombre: "Improvisado",
      precio: 5000,
    });

    expect(linea.origenTipo).toBe("MANUAL");
  });

  it("no deja añadir una línea a un evento de otro emprendimiento", async () => {
    const ajeno = await crearEvento(B);

    await expect(
      eventoService.agregarLineaManual(scopeA, ajeno.id, { nombre: "Robado", precio: 1 }),
    ).rejects.toMatchObject({ codigo: "EVENTO_NO_ENCONTRADO" });

    expect(await prisma.eventoItem.count()).toBe(0);
  });

  it("no deja traer una categoría de otro emprendimiento a un evento propio", async () => {
    const evento = await crearEvento(A);
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    await expect(
      eventoService.agregarCategoriaComoLinea(scopeA, evento.id, ajena.id),
    ).rejects.toMatchObject({ codigo: "CATEGORIA_NO_ENCONTRADA" });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- evento`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar el repositorio**

`Backend/src/repositories/evento.repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type Evento = {
  id: string;
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  meta: number;
  catalogoBloqueado: boolean;
  estado: "ACTIVO" | "CERRADO";
};

export type NuevoEvento = {
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  meta: number;
};

export type EventoItem = {
  id: string;
  nombre: string;
  precio: number;
  origenTipo: "CATEGORIA" | "PRODUCTO" | "MANUAL";
  origenId: string | null;
};

export type NuevaLinea = {
  nombre: string;
  precio: number;
  origenTipo: "CATEGORIA" | "PRODUCTO" | "MANUAL";
  origenId: string | null;
};

export type Descuento = {
  id: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
};

export type NuevoDescuento = {
  nombre: string;
  porcentaje: number;
  activo: boolean;
};

const camposEvento = {
  id: true,
  nombre: true,
  fechaInicio: true,
  fechaFin: true,
  meta: true,
  catalogoBloqueado: true,
  estado: true,
} as const;

const camposLinea = {
  id: true,
  nombre: true,
  precio: true,
  origenTipo: true,
  origenId: true,
} as const;

const camposDescuento = {
  id: true,
  nombre: true,
  porcentaje: true,
  activo: true,
} as const;

export const eventoRepository = {
  async listar(scope: Scope): Promise<Evento[]> {
    return prisma.evento.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: camposEvento,
      orderBy: { fechaInicio: "desc" },
    });
  },

  async crear(scope: Scope, datos: NuevoEvento): Promise<Evento> {
    return prisma.evento.create({
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposEvento,
    });
  },

  async buscarPorId(scope: Scope, id: string): Promise<Evento | null> {
    return prisma.evento.findFirst({
      where: { id, emprendimientoId: scope.emprendimientoId },
      select: camposEvento,
    });
  },

  /** Devuelve `null` si el evento no es de este emprendimiento. */
  async cambiarCandado(
    scope: Scope,
    id: string,
    bloqueado: boolean,
  ): Promise<Evento | null> {
    const { count } = await prisma.evento.updateMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
      data: { catalogoBloqueado: bloqueado },
    });

    if (count === 0) return null;

    return prisma.evento.findUniqueOrThrow({ where: { id }, select: camposEvento });
  },

  async listarLineas(scope: Scope, eventoId: string): Promise<EventoItem[]> {
    return prisma.eventoItem.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: camposLinea,
      orderBy: { creadoEn: "asc" },
    });
  },

  async crearLinea(
    scope: Scope,
    eventoId: string,
    datos: NuevaLinea,
  ): Promise<EventoItem> {
    return prisma.eventoItem.create({
      data: {
        ...datos,
        id: randomUUID(),
        eventoId,
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposLinea,
    });
  },

  /** Devuelve `false` si la línea no es de este emprendimiento. */
  async eliminarLinea(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.eventoItem.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });

    return count === 1;
  },

  async listarDescuentos(scope: Scope, eventoId: string): Promise<Descuento[]> {
    return prisma.descuento.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: camposDescuento,
      orderBy: { creadoEn: "asc" },
    });
  },

  async crearDescuento(
    scope: Scope,
    eventoId: string,
    datos: NuevoDescuento,
  ): Promise<Descuento> {
    return prisma.descuento.create({
      data: {
        ...datos,
        id: randomUUID(),
        eventoId,
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposDescuento,
    });
  },
};
```

- [ ] **Step 4: Implementar el servicio**

`Backend/src/services/evento.service.ts`:

```ts
import { ErrorDeNegocio } from "../errors.js";
import { catalogoRepository } from "../repositories/catalogo.repository.js";
import {
  eventoRepository,
  type EventoItem,
} from "../repositories/evento.repository.js";
import type { Scope } from "../repositories/scope.js";

/**
 * Comprueba que el evento existe, es de este emprendimiento y admite cambios en
 * su catálogo. El candado es lo que impide que alguien toque los precios con la
 * fila de clientes al frente.
 */
async function exigirEventoEditable(scope: Scope, eventoId: string) {
  const evento = await eventoRepository.buscarPorId(scope, eventoId);

  if (!evento) {
    throw new ErrorDeNegocio(
      "EVENTO_NO_ENCONTRADO",
      "El evento no existe",
      404,
    );
  }

  if (evento.catalogoBloqueado) {
    throw new ErrorDeNegocio(
      "CATALOGO_BLOQUEADO",
      "El catálogo del evento está bloqueado. Quita el candado para editarlo.",
      409,
    );
  }

  return evento;
}

export const eventoService = {
  /**
   * Trae una categoría completa como UNA sola línea. Copia nombre y precio en
   * ese momento: si mañana cambia el precio de la categoría, lo vendido en esta
   * feria sigue diciendo la verdad.
   */
  async agregarCategoriaComoLinea(
    scope: Scope,
    eventoId: string,
    categoriaId: string,
  ): Promise<EventoItem> {
    await exigirEventoEditable(scope, eventoId);

    const categorias = await catalogoRepository.listarCategorias(scope);
    const categoria = categorias.find((c) => c.id === categoriaId);

    if (!categoria) {
      throw new ErrorDeNegocio(
        "CATEGORIA_NO_ENCONTRADA",
        "La categoría no existe",
        404,
      );
    }

    return eventoRepository.crearLinea(scope, eventoId, {
      nombre: categoria.nombre,
      precio: categoria.precio,
      origenTipo: "CATEGORIA",
      origenId: categoria.id,
    });
  },

  async agregarLineaManual(
    scope: Scope,
    eventoId: string,
    datos: { nombre: string; precio: number },
  ): Promise<EventoItem> {
    await exigirEventoEditable(scope, eventoId);

    return eventoRepository.crearLinea(scope, eventoId, {
      ...datos,
      origenTipo: "MANUAL",
      origenId: null,
    });
  },
};
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 6 pruebas nuevas de eventos.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): eventos, lineas y candado del catalogo"
```

---

### Task 5: Servicio de cálculo del dinero

Este servicio no toca la base de datos. Es aritmética pura, y por eso puede probarse a fondo: es el sitio donde un error de un peso se convierte en una caja que no cuadra.

**Files:**
- Create: `Backend/src/services/calculo.service.ts`
- Test: `Backend/test/calculo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `calcularVenta(entrada: EntradaCalculo): ResultadoCalculo`, con
  `EntradaCalculo = { lineas: LineaVendida[]; descuentoPct: number; comisionPct: number; recibido: number }`,
  `LineaVendida = { nombre: string; precioUnitario: number; cantidad: number }`,
  `ResultadoCalculo = { items: ItemCalculado[]; subtotal: number; descuentoValor: number; total: number; comisionValor: number; neto: number; cambio: number }`,
  `ItemCalculado = LineaVendida & { subtotal: number }`.
  Los porcentajes entran en puntos básicos (150 = 1,5 %).

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/calculo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularVenta } from "../src/services/calculo.service.js";

const sinPago = { descuentoPct: 0, comisionPct: 0, recibido: 0 };

describe("cálculo de una venta", () => {
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

  it("aplica el descuento sobre el subtotal", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 1000, // 10 %
      comisionPct: 0,
      recibido: 0,
    });

    expect(r.descuentoValor).toBe(2400);
    expect(r.total).toBe(21600);
  });

  it("calcula la comisión sobre el total ya descontado, no sobre el subtotal", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 1000, // 10 % -> total 21600
      comisionPct: 500, // 5 % de 21600 = 1080
      recibido: 0,
    });

    expect(r.comisionValor).toBe(1080);
    expect(r.neto).toBe(20520);
  });

  it("reproduce las cifras reales de la feria: QR al 1,5 % sobre 15.000", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
      descuentoPct: 0,
      comisionPct: 150,
      recibido: 0,
    });

    expect(r.total).toBe(15000);
    expect(r.comisionValor).toBe(225);
    expect(r.neto).toBe(14775);
  });

  it("redondea a peso entero, nunca deja decimales", () => {
    // 1,5 % de 12.345 son 185,175: debe quedar 185, no 185,175.
    const r = calcularVenta({
      lineas: [{ nombre: "Suelto", precioUnitario: 12345, cantidad: 1 }],
      descuentoPct: 0,
      comisionPct: 150,
      recibido: 0,
    });

    expect(r.comisionValor).toBe(185);
    expect(Number.isInteger(r.comisionValor)).toBe(true);
    expect(Number.isInteger(r.neto)).toBe(true);
  });

  it("el cambio es lo recibido menos el total, y nunca negativo", () => {
    const conSobra = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 50000,
    });
    expect(conSobra.cambio).toBe(26000);

    const insuficiente = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 10000,
    });
    expect(insuficiente.cambio).toBe(0);
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

  it("una venta sin líneas vale cero en todo", () => {
    const r = calcularVenta({ lineas: [], descuentoPct: 1000, comisionPct: 500, recibido: 0 });

    expect(r.subtotal).toBe(0);
    expect(r.descuentoValor).toBe(0);
    expect(r.total).toBe(0);
    expect(r.comisionValor).toBe(0);
    expect(r.neto).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- calculo`
Expected: FAIL — no existe `calculo.service`.

- [ ] **Step 3: Implementar**

`Backend/src/services/calculo.service.ts`:

```ts
export type LineaVendida = {
  nombre: string;
  precioUnitario: number;
  cantidad: number;
};

export type ItemCalculado = LineaVendida & {
  subtotal: number;
};

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

/** Los porcentajes viajan en puntos básicos, así que el divisor es 10.000. */
const BASE_PORCENTAJE = 10_000;

/**
 * Toda la aritmética del dinero del sistema vive aquí, en enteros de pesos.
 *
 * El orden importa y no es intercambiable: el descuento se aplica al subtotal,
 * y la comisión al total ya descontado, porque la pasarela cobra sobre lo que
 * el cliente pagó de verdad, no sobre el precio de lista.
 */
export function calcularVenta(entrada: EntradaCalculo): ResultadoCalculo {
  const items = entrada.lineas
    .filter((linea) => linea.cantidad > 0)
    .map((linea) => ({
      ...linea,
      subtotal: linea.precioUnitario * linea.cantidad,
    }));

  const subtotal = items.reduce((suma, item) => suma + item.subtotal, 0);
  const descuentoValor = Math.round((subtotal * entrada.descuentoPct) / BASE_PORCENTAJE);
  const total = subtotal - descuentoValor;
  const comisionValor = Math.round((total * entrada.comisionPct) / BASE_PORCENTAJE);
  const neto = total - comisionValor;
  const cambio = Math.max(0, entrada.recibido - total);

  return { items, subtotal, descuentoValor, total, comisionValor, neto, cambio };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 8 pruebas nuevas de cálculo.

- [ ] **Step 5: Commit**

```bash
git add Backend
git commit -m "feat(backend): servicio de calculo del dinero en enteros"
```

---

### Task 6: Registro de ventas idempotente

**Files:**
- Create: `Backend/src/repositories/venta.repository.ts`
- Create: `Backend/src/services/venta.service.ts`
- Test: `Backend/test/venta.test.ts`

**Interfaces:**
- Consumes: `prisma`, `Scope`, `ErrorDeNegocio`, `calcularVenta`, `eventoRepository`, `metodoPagoRepository`.
- Produces:
  - `ventaRepository` con `registrar(scope, venta)`, `buscarPorUuid(scope, uuid)`, `listarDelEvento(scope, eventoId)`, `totalesDelEvento(scope, eventoId)`.
  - `ventaService.registrar(scope, usuarioId, entrada)` donde `entrada = { uuid, eventoId, lineas, descuentoId, metodoPagoId, recibido, creadaEnDispositivo }`.
  - `TotalesEvento = { cantidadVentas: number; bruto: number; descuentos: number; comisiones: number; neto: number; porMetodo: { metodo: string; total: number }[] }`.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/venta.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { eventoRepository } from "../src/repositories/evento.repository.js";
import { ventaRepository } from "../src/repositories/venta.repository.js";
import { ventaService } from "../src/services/venta.service.js";
import { metodoPagoService } from "../src/services/metodoPago.service.js";

const A = "emp-a";
const scopeA = { emprendimientoId: A };
let eventoId = "";
let qrId = "";
let efectivoId = "";

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.create({ data: { id: A, nombre: "Dodoco" } });
  await prisma.usuario.create({
    data: {
      id: "u1",
      email: "a@dodoco.co",
      passwordHash: "h",
      nombre: "Ana",
      rol: "ADMIN",
      emprendimientoId: A,
    },
  });

  const evento = await eventoRepository.crear(scopeA, {
    nombre: "Feria",
    fechaInicio: new Date(),
    fechaFin: null,
    meta: 1000000,
  });
  eventoId = evento.id;

  const metodos = await metodoPagoService.aplicarPreajusteBold(scopeA);
  efectivoId = metodos.find((m) => m.nombre === "Efectivo")!.id;
  qrId = metodos.find((m) => m.nombre === "QR")!.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function entrada(uuid: string, metodoPagoId: string) {
  return {
    uuid,
    eventoId,
    lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
    descuentoId: null,
    metodoPagoId,
    recibido: 0,
    creadaEnDispositivo: new Date(),
  };
}

describe("registro de ventas", () => {
  it("guarda la venta con sus totales y su detalle", async () => {
    const venta = await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), qrId));

    expect(venta.total).toBe(15000);
    expect(venta.comisionValor).toBe(225);
    expect(venta.neto).toBe(14775);
    expect(venta.metodoPagoNombre).toBe("QR");

    const items = await prisma.ventaItem.findMany({ where: { ventaId: venta.id } });
    expect(items).toHaveLength(1);
    expect(items[0].subtotal).toBe(15000);
  });

  it("reenviar el mismo uuid no duplica la venta", async () => {
    const uuid = randomUUID();

    const primera = await ventaService.registrar(scopeA, "u1", entrada(uuid, qrId));
    const segunda = await ventaService.registrar(scopeA, "u1", entrada(uuid, qrId));

    expect(segunda.id).toBe(primera.id);
    expect(await prisma.venta.count()).toBe(1);
    expect(await prisma.ventaItem.count()).toBe(1);
  });

  it("dos envíos simultáneos del mismo uuid dejan una sola venta", async () => {
    const uuid = randomUUID();

    await Promise.allSettled([
      ventaService.registrar(scopeA, "u1", entrada(uuid, qrId)),
      ventaService.registrar(scopeA, "u1", entrada(uuid, qrId)),
    ]);

    expect(await prisma.venta.count()).toBe(1);
  });

  it("guarda la comisión del momento aunque después cambie la del método", async () => {
    const venta = await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), qrId));

    await prisma.metodoPago.update({ where: { id: qrId }, data: { comisionPct: 9999 } });

    const guardada = await ventaRepository.buscarPorUuid(scopeA, venta.uuid);
    expect(guardada?.comisionPct).toBe(150);
    expect(guardada?.neto).toBe(14775);
  });

  it("rechaza vender en un evento de otro emprendimiento", async () => {
    await expect(
      ventaService.registrar({ emprendimientoId: "otro" }, "u1", entrada(randomUUID(), qrId)),
    ).rejects.toMatchObject({ codigo: "EVENTO_NO_ENCONTRADO" });
  });

  it("los totales del evento separan bruto, comisiones y neto por método", async () => {
    await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), qrId));
    await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), efectivoId));

    const totales = await ventaRepository.totalesDelEvento(scopeA, eventoId);

    expect(totales.cantidadVentas).toBe(2);
    expect(totales.bruto).toBe(30000);
    expect(totales.comisiones).toBe(225);
    expect(totales.neto).toBe(29775);
    expect(totales.porMetodo).toEqual(
      expect.arrayContaining([
        { metodo: "QR", total: 15000 },
        { metodo: "Efectivo", total: 15000 },
      ]),
    );
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- venta`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar el repositorio**

`Backend/src/repositories/venta.repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type VentaGuardada = {
  id: string;
  uuid: string;
  subtotal: number;
  descuentoNombre: string | null;
  descuentoPct: number;
  descuentoValor: number;
  total: number;
  metodoPagoNombre: string;
  comisionPct: number;
  comisionValor: number;
  neto: number;
  recibido: number;
  cambio: number;
  creadaEnDispositivo: Date;
};

export type NuevaVenta = Omit<VentaGuardada, "id"> & {
  eventoId: string;
  usuarioId: string;
  items: { nombre: string; precioUnitario: number; cantidad: number; subtotal: number }[];
};

export type TotalesEvento = {
  cantidadVentas: number;
  bruto: number;
  descuentos: number;
  comisiones: number;
  neto: number;
  porMetodo: { metodo: string; total: number }[];
};

const campos = {
  id: true,
  uuid: true,
  subtotal: true,
  descuentoNombre: true,
  descuentoPct: true,
  descuentoValor: true,
  total: true,
  metodoPagoNombre: true,
  comisionPct: true,
  comisionValor: true,
  neto: true,
  recibido: true,
  cambio: true,
  creadaEnDispositivo: true,
} as const;

/** Detecta el choque de la restricción única sobre `uuid`. */
function esUuidRepetido(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export const ventaRepository = {
  async buscarPorUuid(scope: Scope, uuid: string): Promise<VentaGuardada | null> {
    return prisma.venta.findFirst({
      where: { uuid, emprendimientoId: scope.emprendimientoId },
      select: campos,
    });
  },

  /**
   * Inserta la venta y su detalle en una transacción. Si el `uuid` ya existía,
   * devuelve la venta guardada en vez de fallar: reenviar es lo normal cuando
   * el celular pierde la señal a mitad de envío, y no debe duplicar nada.
   *
   * La idempotencia se apoya en la restricción única de la base, no en una
   * consulta previa: entre consultar y escribir cabe una carrera.
   */
  async registrar(scope: Scope, venta: NuevaVenta): Promise<VentaGuardada> {
    const { items, eventoId, usuarioId, ...cabecera } = venta;
    const id = randomUUID();

    try {
      return await prisma.$transaction(async (tx) => {
        const creada = await tx.venta.create({
          data: {
            ...cabecera,
            id,
            eventoId,
            usuarioId,
            emprendimientoId: scope.emprendimientoId,
          },
          select: campos,
        });

        await tx.ventaItem.createMany({
          data: items.map((item) => ({
            ...item,
            id: randomUUID(),
            ventaId: id,
            emprendimientoId: scope.emprendimientoId,
          })),
        });

        return creada;
      });
    } catch (error) {
      if (esUuidRepetido(error)) {
        const existente = await this.buscarPorUuid(scope, venta.uuid);
        if (existente) return existente;
      }
      throw error;
    }
  },

  async listarDelEvento(scope: Scope, eventoId: string): Promise<VentaGuardada[]> {
    return prisma.venta.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: campos,
      orderBy: { creadaEnDispositivo: "desc" },
    });
  },

  async totalesDelEvento(scope: Scope, eventoId: string): Promise<TotalesEvento> {
    const ventas = await prisma.venta.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: {
        total: true,
        descuentoValor: true,
        comisionValor: true,
        neto: true,
        metodoPagoNombre: true,
      },
    });

    const acumuladoPorMetodo = new Map<string, number>();

    for (const venta of ventas) {
      acumuladoPorMetodo.set(
        venta.metodoPagoNombre,
        (acumuladoPorMetodo.get(venta.metodoPagoNombre) ?? 0) + venta.total,
      );
    }

    return {
      cantidadVentas: ventas.length,
      bruto: ventas.reduce((s, v) => s + v.total, 0),
      descuentos: ventas.reduce((s, v) => s + v.descuentoValor, 0),
      comisiones: ventas.reduce((s, v) => s + v.comisionValor, 0),
      neto: ventas.reduce((s, v) => s + v.neto, 0),
      porMetodo: [...acumuladoPorMetodo].map(([metodo, total]) => ({ metodo, total })),
    };
  },
};
```

- [ ] **Step 4: Implementar el servicio**

`Backend/src/services/venta.service.ts`:

```ts
import { ErrorDeNegocio } from "../errors.js";
import { eventoRepository } from "../repositories/evento.repository.js";
import { metodoPagoRepository } from "../repositories/metodoPago.repository.js";
import type { Scope } from "../repositories/scope.js";
import {
  ventaRepository,
  type VentaGuardada,
} from "../repositories/venta.repository.js";
import { calcularVenta, type LineaVendida } from "./calculo.service.js";

export type EntradaVenta = {
  uuid: string;
  eventoId: string;
  lineas: LineaVendida[];
  descuentoId: string | null;
  metodoPagoId: string;
  recibido: number;
  creadaEnDispositivo: Date;
};

export const ventaService = {
  async registrar(
    scope: Scope,
    usuarioId: string,
    entrada: EntradaVenta,
  ): Promise<VentaGuardada> {
    const evento = await eventoRepository.buscarPorId(scope, entrada.eventoId);
    if (!evento) {
      throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
    }

    if (evento.estado === "CERRADO") {
      throw new ErrorDeNegocio(
        "EVENTO_CERRADO",
        "El evento está cerrado y ya no admite ventas",
        409,
      );
    }

    const metodos = await metodoPagoRepository.listar(scope);
    const metodo = metodos.find((m) => m.id === entrada.metodoPagoId);
    if (!metodo) {
      throw new ErrorDeNegocio(
        "METODO_PAGO_NO_ENCONTRADO",
        "El método de pago no existe",
        404,
      );
    }

    let descuentoNombre: string | null = null;
    let descuentoPct = 0;

    if (entrada.descuentoId) {
      const descuentos = await eventoRepository.listarDescuentos(scope, entrada.eventoId);
      const descuento = descuentos.find((d) => d.id === entrada.descuentoId);

      if (!descuento) {
        throw new ErrorDeNegocio(
          "DESCUENTO_NO_ENCONTRADO",
          "El descuento no existe en este evento",
          404,
        );
      }

      descuentoNombre = descuento.nombre;
      descuentoPct = descuento.porcentaje;
    }

    const calculo = calcularVenta({
      lineas: entrada.lineas,
      descuentoPct,
      comisionPct: metodo.comisionPct,
      recibido: entrada.recibido,
    });

    if (calculo.total <= 0) {
      throw new ErrorDeNegocio(
        "VENTA_SIN_PRODUCTOS",
        "La venta no tiene productos que cobrar",
        400,
      );
    }

    // Se guardan los porcentajes y nombres de este instante, no referencias:
    // si mañana cambia la tarifa o el precio, el informe de esta feria no cambia.
    return ventaRepository.registrar(scope, {
      uuid: entrada.uuid,
      eventoId: entrada.eventoId,
      usuarioId,
      subtotal: calculo.subtotal,
      descuentoNombre,
      descuentoPct,
      descuentoValor: calculo.descuentoValor,
      total: calculo.total,
      metodoPagoNombre: metodo.nombre,
      comisionPct: metodo.comisionPct,
      comisionValor: calculo.comisionValor,
      neto: calculo.neto,
      recibido: entrada.recibido,
      cambio: calculo.cambio,
      creadaEnDispositivo: entrada.creadaEnDispositivo,
      items: calculo.items,
    });
  },
};
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 6 pruebas nuevas de ventas.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): registro de ventas idempotente con totales"
```

---

### Task 7: Rutas de catálogo y métodos de pago

**Files:**
- Create: `Backend/src/schemas/catalogo.schema.ts`
- Create: `Backend/src/controllers/catalogo.controller.ts`
- Create: `Backend/src/routes/catalogo.routes.ts`
- Modify: `Backend/src/app.ts`
- Test: `Backend/test/catalogo.routes.test.ts`

**Interfaces:**
- Consumes: `catalogoRepository`, `metodoPagoRepository`, `metodoPagoService`, `autenticar`, `soloAdmin`, `validar`.
- Produces: rutas `GET|POST /catalogo/categorias`, `PUT|DELETE /catalogo/categorias/:id`, `GET|POST /catalogo/metodos-pago`, `POST /catalogo/metodos-pago/preajuste-bold`. Esquemas `categoriaSchema` y `metodoPagoSchema` exportados para la Task 10.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/catalogo.routes.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { createApp } from "../src/app.js";

const app = createApp();

async function registrarYEntrar(nombre: string, email: string) {
  await request(app).post("/auth/registro").send({
    nombreEmprendimiento: nombre,
    nombreUsuario: "Dueño",
    email,
    password: "clave-segura-123",
  });

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "clave-segura-123" });

  return login.body.accessToken as string;
}

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de catálogo", () => {
  it("exige sesión", async () => {
    const res = await request(app).get("/catalogo/categorias");

    expect(res.status).toBe(401);
  });

  it("crea y lista categorías del emprendimiento propio", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const creada = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Pines", precio: 12000 });

    expect(creada.status).toBe(201);
    expect(creada.body.precio).toBe(12000);

    const lista = await request(app)
      .get("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`);

    expect(lista.body).toHaveLength(1);
  });

  it("un emprendimiento no ve ni puede tocar las categorías de otro", async () => {
    const tokenA = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const tokenB = await registrarYEntrar("Medias Pao", "b@medias.co");

    const deB = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nombre: "Medias", precio: 15000 });

    const listaDeA = await request(app)
      .get("/catalogo/categorias")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(listaDeA.body).toHaveLength(0);

    const intento = await request(app)
      .put(`/catalogo/categorias/${deB.body.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ nombre: "Robada", precio: 1 });
    expect(intento.status).toBe(404);

    const sigueIgual = await prisma.categoria.findUnique({ where: { id: deB.body.id } });
    expect(sigueIgual?.nombre).toBe("Medias");
  });

  it("rechaza un precio que no sea entero positivo", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const res = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Pines", precio: 12000.5 });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("DATOS_INVALIDOS");
  });

  it("el preajuste de Bold deja los tres métodos configurados", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const res = await request(app)
      .post("/catalogo/metodos-pago/preajuste-bold")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.map((m: { nombre: string }) => m.nombre)).toEqual([
      "Efectivo",
      "QR",
      "Datáfono",
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- catalogo.routes`
Expected: FAIL — 404 en las rutas de catálogo.

- [ ] **Step 3: Implementar los esquemas**

`Backend/src/schemas/catalogo.schema.ts`:

```ts
import { z } from "zod";

/** El dinero es siempre entero de pesos: un decimal aquí es un error de entrada. */
const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .nonnegative("No puede ser negativo");

export const categoriaSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre"),
  precio: pesos,
});

export const metodoPagoSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre"),
  comisionPct: z
    .number()
    .int("La comisión se expresa en puntos básicos enteros")
    .min(0, "No puede ser negativa")
    .max(10_000, "No puede pasar del 100 %"),
  activo: z.boolean(),
});
```

- [ ] **Step 4: Implementar el controlador y las rutas**

`Backend/src/controllers/catalogo.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { catalogoRepository } from "../repositories/catalogo.repository.js";
import { metodoPagoRepository } from "../repositories/metodoPago.repository.js";
import { metodoPagoService } from "../services/metodoPago.service.js";
import { ErrorDeNegocio } from "../errors.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

const noEncontrada = new ErrorDeNegocio(
  "CATEGORIA_NO_ENCONTRADA",
  "La categoría no existe",
  404,
);

export const catalogoController = {
  async listarCategorias(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await catalogoRepository.listarCategorias(scopeDe(req)));
    } catch (error) {
      next(error);
    }
  },

  async crearCategoria(req: Request, res: Response, next: NextFunction) {
    try {
      const creada = await catalogoRepository.crearCategoria(scopeDe(req), req.body);
      res.status(201).json(creada);
    } catch (error) {
      next(error);
    }
  },

  async actualizarCategoria(req: Request, res: Response, next: NextFunction) {
    try {
      const actualizada = await catalogoRepository.actualizarCategoria(
        scopeDe(req),
        req.params.id,
        req.body,
      );

      if (!actualizada) throw noEncontrada;
      res.json(actualizada);
    } catch (error) {
      next(error);
    }
  },

  async eliminarCategoria(req: Request, res: Response, next: NextFunction) {
    try {
      const borrada = await catalogoRepository.eliminarCategoria(
        scopeDe(req),
        req.params.id,
      );

      if (!borrada) throw noEncontrada;
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async listarMetodos(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await metodoPagoRepository.listar(scopeDe(req)));
    } catch (error) {
      next(error);
    }
  },

  async crearMetodo(req: Request, res: Response, next: NextFunction) {
    try {
      const creado = await metodoPagoRepository.crear(scopeDe(req), req.body);
      res.status(201).json(creado);
    } catch (error) {
      next(error);
    }
  },

  async preajusteBold(req: Request, res: Response, next: NextFunction) {
    try {
      const metodos = await metodoPagoService.aplicarPreajusteBold(scopeDe(req));
      res.status(201).json(metodos);
    } catch (error) {
      next(error);
    }
  },
};
```

`Backend/src/routes/catalogo.routes.ts`:

```ts
import { Router } from "express";
import { catalogoController } from "../controllers/catalogo.controller.js";
import { autenticar, soloAdmin } from "../middlewares/autenticar.js";
import { validar } from "../middlewares/validar.js";
import { categoriaSchema, metodoPagoSchema } from "../schemas/catalogo.schema.js";

export const catalogoRoutes = Router();

// Configurar el catálogo es tarea de quien administra el emprendimiento.
catalogoRoutes.use(autenticar);

catalogoRoutes.get("/categorias", catalogoController.listarCategorias);
catalogoRoutes.post("/categorias", soloAdmin, validar(categoriaSchema), catalogoController.crearCategoria);
catalogoRoutes.put("/categorias/:id", soloAdmin, validar(categoriaSchema), catalogoController.actualizarCategoria);
catalogoRoutes.delete("/categorias/:id", soloAdmin, catalogoController.eliminarCategoria);

catalogoRoutes.get("/metodos-pago", catalogoController.listarMetodos);
catalogoRoutes.post("/metodos-pago", soloAdmin, validar(metodoPagoSchema), catalogoController.crearMetodo);
catalogoRoutes.post("/metodos-pago/preajuste-bold", soloAdmin, catalogoController.preajusteBold);
```

Montar en `Backend/src/app.ts`, junto a `app.use("/auth", authRoutes)`:

```ts
import { catalogoRoutes } from "./routes/catalogo.routes.js";
// ...
  app.use("/catalogo", catalogoRoutes);
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 5 pruebas nuevas de rutas de catálogo.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): rutas de catalogo y metodos de pago"
```

---

### Task 8: Rutas de eventos, líneas y descuentos

**Files:**
- Create: `Backend/src/schemas/evento.schema.ts`
- Create: `Backend/src/controllers/evento.controller.ts`
- Create: `Backend/src/routes/evento.routes.ts`
- Modify: `Backend/src/app.ts`
- Test: `Backend/test/evento.routes.test.ts`

**Interfaces:**
- Consumes: `eventoRepository`, `eventoService`, `autenticar`, `soloAdmin`, `validar`.
- Produces: rutas `GET|POST /eventos`, `GET /eventos/:id`, `PATCH /eventos/:id/candado`, `GET|POST /eventos/:id/lineas`, `DELETE /eventos/:id/lineas/:lineaId`, `GET|POST /eventos/:id/descuentos`. Esquemas `eventoSchema`, `lineaSchema`, `candadoSchema`, `descuentoSchema` exportados para la Task 10.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/evento.routes.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { createApp } from "../src/app.js";

const app = createApp();

async function registrarYEntrar(nombre: string, email: string) {
  await request(app).post("/auth/registro").send({
    nombreEmprendimiento: nombre,
    nombreUsuario: "Dueño",
    email,
    password: "clave-segura-123",
  });

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "clave-segura-123" });

  return login.body.accessToken as string;
}

async function crearEvento(token: string) {
  const res = await request(app)
    .post("/eventos")
    .set("Authorization", `Bearer ${token}`)
    .send({ nombre: "Feria de abril", fechaInicio: new Date().toISOString(), meta: 1000000 });

  return res.body.id as string;
}

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de eventos", () => {
  it("crea un evento con la meta indicada y sin candado", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const res = await request(app)
      .post("/eventos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Feria de abril", fechaInicio: new Date().toISOString(), meta: 1000000 });

    expect(res.status).toBe(201);
    expect(res.body.meta).toBe(1000000);
    expect(res.body.catalogoBloqueado).toBe(false);
  });

  it("un emprendimiento no ve los eventos de otro", async () => {
    const tokenA = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const tokenB = await registrarYEntrar("Medias Pao", "b@medias.co");
    await crearEvento(tokenB);

    const lista = await request(app)
      .get("/eventos")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(lista.body).toHaveLength(0);
  });

  it("no deja leer un evento de otro emprendimiento aunque se sepa su id", async () => {
    const tokenA = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const tokenB = await registrarYEntrar("Medias Pao", "b@medias.co");
    const ajeno = await crearEvento(tokenB);

    const res = await request(app)
      .get(`/eventos/${ajeno}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it("con el candado puesto rechaza añadir líneas y lo dice en español", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const eventoId = await crearEvento(token);

    await request(app)
      .patch(`/eventos/${eventoId}/candado`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bloqueado: true });

    const res = await request(app)
      .post(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Improvisado", precio: 5000 });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe("CATALOGO_BLOQUEADO");
    expect(res.body.mensaje).toMatch(/candado/i);
  });

  it("añade una línea manual y la lista", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const eventoId = await crearEvento(token);

    const creada = await request(app)
      .post(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Pines", precio: 12000 });

    expect(creada.status).toBe(201);
    expect(creada.body.origenTipo).toBe("MANUAL");

    const lista = await request(app)
      .get(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`);

    expect(lista.body).toHaveLength(1);
  });

  it("trae una categoría completa como una sola línea", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const eventoId = await crearEvento(token);

    const categoria = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Medias", precio: 15000 });

    const res = await request(app)
      .post(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`)
      .send({ categoriaId: categoria.body.id });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("Medias");
    expect(res.body.precio).toBe(15000);
    expect(res.body.origenTipo).toBe("CATEGORIA");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- evento.routes`
Expected: FAIL — 404 en las rutas de eventos.

- [ ] **Step 3: Implementar los esquemas**

`Backend/src/schemas/evento.schema.ts`:

```ts
import { z } from "zod";

const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .nonnegative("No puede ser negativo");

export const eventoSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre del evento"),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().nullable().optional(),
  meta: pesos,
});

export const candadoSchema = z.object({
  bloqueado: z.boolean(),
});

/**
 * Una línea se añade de dos formas: trayendo una categoría completa, o
 * escribiéndola a mano. La unión discriminada obliga a elegir una, y evita
 * peticiones ambiguas con los dos caminos a medias.
 */
export const lineaSchema = z.union([
  z.object({ categoriaId: z.string().min(1) }),
  z.object({
    nombre: z.string().min(1, "Escribe el nombre de la línea"),
    precio: pesos,
  }),
]);

export const descuentoSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre del descuento"),
  porcentaje: z
    .number()
    .int("El porcentaje se expresa en puntos básicos enteros")
    .min(0, "No puede ser negativo")
    .max(10_000, "No puede pasar del 100 %"),
  activo: z.boolean(),
});
```

- [ ] **Step 4: Implementar el controlador y las rutas**

`Backend/src/controllers/evento.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";
import { eventoRepository } from "../repositories/evento.repository.js";
import { eventoService } from "../services/evento.service.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

const eventoNoEncontrado = new ErrorDeNegocio(
  "EVENTO_NO_ENCONTRADO",
  "El evento no existe",
  404,
);

export const eventoController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await eventoRepository.listar(scopeDe(req)));
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const creado = await eventoRepository.crear(scopeDe(req), {
        nombre: req.body.nombre,
        fechaInicio: req.body.fechaInicio,
        fechaFin: req.body.fechaFin ?? null,
        meta: req.body.meta,
      });
      res.status(201).json(creado);
    } catch (error) {
      next(error);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const evento = await eventoRepository.buscarPorId(scopeDe(req), req.params.id);
      if (!evento) throw eventoNoEncontrado;
      res.json(evento);
    } catch (error) {
      next(error);
    }
  },

  async cambiarCandado(req: Request, res: Response, next: NextFunction) {
    try {
      const evento = await eventoRepository.cambiarCandado(
        scopeDe(req),
        req.params.id,
        req.body.bloqueado,
      );
      if (!evento) throw eventoNoEncontrado;
      res.json(evento);
    } catch (error) {
      next(error);
    }
  },

  async listarLineas(req: Request, res: Response, next: NextFunction) {
    try {
      const evento = await eventoRepository.buscarPorId(scopeDe(req), req.params.id);
      if (!evento) throw eventoNoEncontrado;
      res.json(await eventoRepository.listarLineas(scopeDe(req), req.params.id));
    } catch (error) {
      next(error);
    }
  },

  async crearLinea(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const linea =
        "categoriaId" in req.body
          ? await eventoService.agregarCategoriaComoLinea(
              scope,
              req.params.id,
              req.body.categoriaId,
            )
          : await eventoService.agregarLineaManual(scope, req.params.id, req.body);

      res.status(201).json(linea);
    } catch (error) {
      next(error);
    }
  },

  async eliminarLinea(req: Request, res: Response, next: NextFunction) {
    try {
      const borrada = await eventoRepository.eliminarLinea(
        scopeDe(req),
        req.params.lineaId,
      );

      if (!borrada) {
        throw new ErrorDeNegocio("LINEA_NO_ENCONTRADA", "La línea no existe", 404);
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async listarDescuentos(req: Request, res: Response, next: NextFunction) {
    try {
      const evento = await eventoRepository.buscarPorId(scopeDe(req), req.params.id);
      if (!evento) throw eventoNoEncontrado;
      res.json(await eventoRepository.listarDescuentos(scopeDe(req), req.params.id));
    } catch (error) {
      next(error);
    }
  },

  async crearDescuento(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const evento = await eventoRepository.buscarPorId(scope, req.params.id);
      if (!evento) throw eventoNoEncontrado;

      const creado = await eventoRepository.crearDescuento(
        scope,
        req.params.id,
        req.body,
      );
      res.status(201).json(creado);
    } catch (error) {
      next(error);
    }
  },
};
```

`Backend/src/routes/evento.routes.ts`:

```ts
import { Router } from "express";
import { eventoController } from "../controllers/evento.controller.js";
import { autenticar, soloAdmin } from "../middlewares/autenticar.js";
import { validar } from "../middlewares/validar.js";
import {
  candadoSchema,
  descuentoSchema,
  eventoSchema,
  lineaSchema,
} from "../schemas/evento.schema.js";

export const eventoRoutes = Router();

eventoRoutes.use(autenticar);

eventoRoutes.get("/", eventoController.listar);
eventoRoutes.post("/", soloAdmin, validar(eventoSchema), eventoController.crear);
eventoRoutes.get("/:id", eventoController.obtener);
eventoRoutes.patch("/:id/candado", soloAdmin, validar(candadoSchema), eventoController.cambiarCandado);

eventoRoutes.get("/:id/lineas", eventoController.listarLineas);
eventoRoutes.post("/:id/lineas", soloAdmin, validar(lineaSchema), eventoController.crearLinea);
eventoRoutes.delete("/:id/lineas/:lineaId", soloAdmin, eventoController.eliminarLinea);

eventoRoutes.get("/:id/descuentos", eventoController.listarDescuentos);
eventoRoutes.post("/:id/descuentos", soloAdmin, validar(descuentoSchema), eventoController.crearDescuento);
```

Montar en `Backend/src/app.ts`:

```ts
import { eventoRoutes } from "./routes/evento.routes.js";
// ...
  app.use("/eventos", eventoRoutes);
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 6 pruebas nuevas de rutas de eventos.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): rutas de eventos, lineas y descuentos"
```

---

### Task 9: Rutas de ventas y panel del evento

**Files:**
- Create: `Backend/src/schemas/venta.schema.ts`
- Create: `Backend/src/controllers/venta.controller.ts`
- Create: `Backend/src/routes/venta.routes.ts`
- Modify: `Backend/src/routes/evento.routes.ts`
- Test: `Backend/test/venta.routes.test.ts`

**Interfaces:**
- Consumes: `ventaService`, `ventaRepository`, `eventoRepository`, `autenticar`, `validar`.
- Produces: rutas `POST /eventos/:id/ventas`, `GET /eventos/:id/ventas`, `GET /eventos/:id/totales`. La respuesta de totales oculta `comisiones` y `neto` cuando el rol no es `ADMIN`.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/venta.routes.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { createApp } from "../src/app.js";

const app = createApp();

async function prepararFeria() {
  await request(app).post("/auth/registro").send({
    nombreEmprendimiento: "Dodoco",
    nombreUsuario: "Ana",
    email: "a@dodoco.co",
    password: "clave-segura-123",
  });

  const login = await request(app)
    .post("/auth/login")
    .send({ email: "a@dodoco.co", password: "clave-segura-123" });
  const token = login.body.accessToken as string;
  const auth = { Authorization: `Bearer ${token}` };

  const evento = await request(app)
    .post("/eventos")
    .set(auth)
    .send({ nombre: "Feria", fechaInicio: new Date().toISOString(), meta: 1000000 });

  const metodos = await request(app)
    .post("/catalogo/metodos-pago/preajuste-bold")
    .set(auth)
    .send({});

  const qr = metodos.body.find((m: { nombre: string }) => m.nombre === "QR");

  return { token, auth, eventoId: evento.body.id as string, qrId: qr.id as string };
}

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de ventas", () => {
  it("registra una venta y devuelve sus totales", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();

    const res = await request(app)
      .post(`/eventos/${eventoId}/ventas`)
      .set(auth)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
        metodoPagoId: qrId,
        descuentoId: null,
        recibido: 20000,
        creadaEnDispositivo: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(15000);
    expect(res.body.cambio).toBe(5000);
  });

  it("reenviar el mismo uuid devuelve la misma venta y no duplica", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();
    const uuid = randomUUID();

    const cuerpo = {
      uuid,
      lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
      metodoPagoId: qrId,
      descuentoId: null,
      recibido: 0,
      creadaEnDispositivo: new Date().toISOString(),
    };

    const primera = await request(app).post(`/eventos/${eventoId}/ventas`).set(auth).send(cuerpo);
    const segunda = await request(app).post(`/eventos/${eventoId}/ventas`).set(auth).send(cuerpo);

    expect(segunda.body.id).toBe(primera.body.id);
    expect(await prisma.venta.count()).toBe(1);
  });

  it("el panel muestra bruto, meta y desglose por método", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();

    await request(app)
      .post(`/eventos/${eventoId}/ventas`)
      .set(auth)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 2 }],
        metodoPagoId: qrId,
        descuentoId: null,
        recibido: 0,
        creadaEnDispositivo: new Date().toISOString(),
      });

    const res = await request(app).get(`/eventos/${eventoId}/totales`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.bruto).toBe(30000);
    expect(res.body.meta).toBe(1000000);
    expect(res.body.porMetodo).toEqual([{ metodo: "QR", total: 30000 }]);
  });

  it("el vendedor no ve comisiones ni neto en el panel", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();

    await request(app)
      .post(`/eventos/${eventoId}/ventas`)
      .set(auth)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
        metodoPagoId: qrId,
        descuentoId: null,
        recibido: 0,
        creadaEnDispositivo: new Date().toISOString(),
      });

    // El usuario del registro es ADMIN, así que sí las ve.
    const comoAdmin = await request(app).get(`/eventos/${eventoId}/totales`).set(auth);
    expect(comoAdmin.body.comisiones).toBe(225);
    expect(comoAdmin.body.neto).toBe(14775);

    // Un vendedor del mismo emprendimiento no debe verlas.
    await prisma.usuario.create({
      data: {
        id: "vendedor-1",
        email: "v@dodoco.co",
        passwordHash: "no-se-usa",
        nombre: "Vendedor",
        rol: "VENDEDOR",
        emprendimientoId: (await prisma.emprendimiento.findFirstOrThrow()).id,
      },
    });

    const { firmarAccessToken } = await import("../src/services/token.service.js");
    const tokenVendedor = firmarAccessToken({
      id: "vendedor-1",
      email: "v@dodoco.co",
      nombre: "Vendedor",
      rol: "VENDEDOR",
      emprendimientoId: (await prisma.emprendimiento.findFirstOrThrow()).id,
    });

    const comoVendedor = await request(app)
      .get(`/eventos/${eventoId}/totales`)
      .set("Authorization", `Bearer ${tokenVendedor}`);

    expect(comoVendedor.body.bruto).toBe(15000);
    expect(comoVendedor.body).not.toHaveProperty("comisiones");
    expect(comoVendedor.body).not.toHaveProperty("neto");
  });

  it("no deja registrar una venta en el evento de otro emprendimiento", async () => {
    const primera = await prepararFeria();

    await request(app).post("/auth/registro").send({
      nombreEmprendimiento: "Medias Pao",
      nombreUsuario: "Beto",
      email: "b@medias.co",
      password: "clave-segura-123",
    });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "b@medias.co", password: "clave-segura-123" });

    const res = await request(app)
      .post(`/eventos/${primera.eventoId}/ventas`)
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Robo", precioUnitario: 1, cantidad: 1 }],
        metodoPagoId: primera.qrId,
        descuentoId: null,
        recibido: 0,
        creadaEnDispositivo: new Date().toISOString(),
      });

    expect(res.status).toBe(404);
    expect(await prisma.venta.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- venta.routes`
Expected: FAIL — 404 en las rutas de ventas.

- [ ] **Step 3: Implementar el esquema**

`Backend/src/schemas/venta.schema.ts`:

```ts
import { z } from "zod";

const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .nonnegative("No puede ser negativo");

export const ventaSchema = z.object({
  /** Lo genera el dispositivo. Es la llave que impide duplicar al reintentar. */
  uuid: z.string().min(8, "Falta el identificador de la venta"),
  lineas: z
    .array(
      z.object({
        nombre: z.string().min(1),
        precioUnitario: pesos,
        cantidad: z.number().int("La cantidad debe ser entera").positive("Debe ser mayor que cero"),
      }),
    )
    .min(1, "La venta no tiene productos"),
  metodoPagoId: z.string().min(1, "Falta el método de pago"),
  descuentoId: z.string().nullable(),
  recibido: pesos,
  creadaEnDispositivo: z.coerce.date(),
});
```

- [ ] **Step 4: Implementar el controlador y las rutas**

`Backend/src/controllers/venta.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";
import { eventoRepository } from "../repositories/evento.repository.js";
import { ventaRepository } from "../repositories/venta.repository.js";
import { ventaService } from "../services/venta.service.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

export const ventaController = {
  async registrar(req: Request, res: Response, next: NextFunction) {
    try {
      const venta = await ventaService.registrar(scopeDe(req), req.auth!.usuarioId, {
        ...req.body,
        eventoId: req.params.id,
      });

      res.status(201).json(venta);
    } catch (error) {
      next(error);
    }
  },

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const evento = await eventoRepository.buscarPorId(scope, req.params.id);
      if (!evento) {
        throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
      }

      res.json(await ventaRepository.listarDelEvento(scope, req.params.id));
    } catch (error) {
      next(error);
    }
  },

  /**
   * El vendedor ve lo que cobró y cuánto falta para la meta; no ve comisiones
   * ni ganancia neta, porque confunden en plena feria. Esas cifras son del
   * administrador.
   */
  async totales(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const evento = await eventoRepository.buscarPorId(scope, req.params.id);
      if (!evento) {
        throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
      }

      const totales = await ventaRepository.totalesDelEvento(scope, req.params.id);
      const comun = {
        cantidadVentas: totales.cantidadVentas,
        bruto: totales.bruto,
        descuentos: totales.descuentos,
        porMetodo: totales.porMetodo,
        meta: evento.meta,
      };

      if (req.auth!.rol !== "ADMIN") {
        res.json(comun);
        return;
      }

      res.json({ ...comun, comisiones: totales.comisiones, neto: totales.neto });
    } catch (error) {
      next(error);
    }
  },
};
```

`Backend/src/routes/venta.routes.ts`:

```ts
import { Router } from "express";
import { ventaController } from "../controllers/venta.controller.js";
import { validar } from "../middlewares/validar.js";
import { ventaSchema } from "../schemas/venta.schema.js";

/**
 * `mergeParams` es necesario: estas rutas se montan bajo `/eventos/:id`, y sin
 * él `req.params.id` llegaría vacío al controlador.
 */
export const ventaRoutes = Router({ mergeParams: true });

ventaRoutes.post("/ventas", validar(ventaSchema), ventaController.registrar);
ventaRoutes.get("/ventas", ventaController.listar);
ventaRoutes.get("/totales", ventaController.totales);
```

Montar dentro de `Backend/src/routes/evento.routes.ts`, al final del archivo (después de `autenticar`, para que herede la sesión):

```ts
import { ventaRoutes } from "./venta.routes.js";
// ...
eventoRoutes.use("/:id", ventaRoutes);
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 5 pruebas nuevas de rutas de ventas.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): rutas de ventas y panel del evento"
```

---

### Task 10: Documentación OpenAPI del dominio

**Files:**
- Modify: `Backend/src/docs/openapi.ts`
- Modify: `Backend/test/docs.test.ts`

**Interfaces:**
- Consumes: `categoriaSchema`, `metodoPagoSchema`, `eventoSchema`, `candadoSchema`, `lineaSchema`, `descuentoSchema`, `ventaSchema`.
- Produces: el documento OpenAPI ampliado con los endpoints del dominio.

**Recordatorio:** `test/docs.test.ts` compara los paths con una **lista cerrada**. Hay que actualizarla con todas las rutas nuevas o la suite romperá.

- [ ] **Step 1: Escribir la prueba que falla**

Reemplazar la comparación de paths en `Backend/test/docs.test.ts` por la lista completa, y añadir una prueba de seguridad:

```ts
  it("publica el documento OpenAPI con todos los endpoints", async () => {
    const res = await request(createApp()).get("/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths).sort()).toEqual([
      "/auth/login",
      "/auth/refresh",
      "/auth/registro",
      "/auth/yo",
      "/catalogo/categorias",
      "/catalogo/categorias/{id}",
      "/catalogo/metodos-pago",
      "/catalogo/metodos-pago/preajuste-bold",
      "/eventos",
      "/eventos/{id}",
      "/eventos/{id}/candado",
      "/eventos/{id}/descuentos",
      "/eventos/{id}/lineas",
      "/eventos/{id}/lineas/{lineaId}",
      "/eventos/{id}/totales",
      "/eventos/{id}/ventas",
    ]);
  });

  it("todos los endpoints del dominio exigen token", async () => {
    const res = await request(createApp()).get("/docs.json");
    const paths = res.body.paths as Record<string, Record<string, { security?: unknown }>>;

    const delDominio = Object.keys(paths).filter((p) => !p.startsWith("/auth/"));
    expect(delDominio.length).toBeGreaterThan(0);

    for (const ruta of delDominio) {
      for (const operacion of Object.values(paths[ruta])) {
        expect(operacion.security).toEqual([{ bearerAuth: [] }]);
      }
    }
  });
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- docs`
Expected: FAIL — faltan los paths del dominio en el documento.

- [ ] **Step 3: Ampliar el documento**

En `Backend/src/docs/openapi.ts`, añadir dentro de `paths` (conservando los cuatro de `/auth`). Todas las operaciones del dominio llevan `security: [{ bearerAuth: [] }]`, que es el esquema ya declarado en `components`:

```ts
    "/catalogo/categorias": {
      get: {
        summary: "Listar las categorías del emprendimiento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de categorías" }, "401": { description: "No autenticado" } },
      },
      post: {
        summary: "Crear una categoría",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: categoriaSchema } } },
        responses: {
          "201": { description: "Categoría creada" },
          "400": { description: "Datos inválidos" },
          "403": { description: "Solo el administrador" },
        },
      },
    },
    "/catalogo/categorias/{id}": {
      put: {
        summary: "Actualizar una categoría",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: categoriaSchema } } },
        responses: { "200": { description: "Actualizada" }, "404": { description: "No existe" } },
      },
      delete: {
        summary: "Eliminar una categoría",
        security: [{ bearerAuth: [] }],
        responses: { "204": { description: "Eliminada" }, "404": { description: "No existe" } },
      },
    },
    "/catalogo/metodos-pago": {
      get: {
        summary: "Listar los métodos de pago",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de métodos" } },
      },
      post: {
        summary: "Crear un método de pago",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: metodoPagoSchema } } },
        responses: { "201": { description: "Creado" }, "400": { description: "Datos inválidos" } },
      },
    },
    "/catalogo/metodos-pago/preajuste-bold": {
      post: {
        summary: "Aplicar las comisiones estándar de Bold (efectivo 0 %, QR 1,5 %, datáfono 5 %)",
        security: [{ bearerAuth: [] }],
        responses: {
          "201": { description: "Métodos creados" },
          "409": { description: "Ya hay métodos configurados" },
        },
      },
    },
    "/eventos": {
      get: {
        summary: "Listar los eventos del emprendimiento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de eventos" } },
      },
      post: {
        summary: "Crear un evento",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: eventoSchema } } },
        responses: { "201": { description: "Evento creado" }, "400": { description: "Datos inválidos" } },
      },
    },
    "/eventos/{id}": {
      get: {
        summary: "Obtener un evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "El evento" }, "404": { description: "No existe" } },
      },
    },
    "/eventos/{id}/candado": {
      patch: {
        summary: "Bloquear o desbloquear el catálogo del evento",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: candadoSchema } } },
        responses: { "200": { description: "Candado actualizado" }, "404": { description: "No existe" } },
      },
    },
    "/eventos/{id}/lineas": {
      get: {
        summary: "Listar las líneas del evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de líneas" } },
      },
      post: {
        summary: "Añadir una línea, trayendo una categoría completa o escribiéndola a mano",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: lineaSchema } } },
        responses: {
          "201": { description: "Línea añadida" },
          "409": { description: "El catálogo está bloqueado" },
        },
      },
    },
    "/eventos/{id}/lineas/{lineaId}": {
      delete: {
        summary: "Eliminar una línea del evento",
        security: [{ bearerAuth: [] }],
        responses: { "204": { description: "Eliminada" }, "404": { description: "No existe" } },
      },
    },
    "/eventos/{id}/descuentos": {
      get: {
        summary: "Listar los descuentos del evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de descuentos" } },
      },
      post: {
        summary: "Crear un descuento del evento",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: descuentoSchema } } },
        responses: { "201": { description: "Creado" }, "400": { description: "Datos inválidos" } },
      },
    },
    "/eventos/{id}/ventas": {
      get: {
        summary: "Listar las ventas del evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de ventas" } },
      },
      post: {
        summary: "Registrar una venta. Es idempotente: reenviar el mismo uuid no duplica",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: ventaSchema } } },
        responses: {
          "201": { description: "Venta registrada, o la ya existente con ese uuid" },
          "404": { description: "Evento, método de pago o descuento inexistente" },
          "409": { description: "El evento está cerrado" },
        },
      },
    },
    "/eventos/{id}/totales": {
      get: {
        summary: "Totales del evento. Las comisiones y el neto solo se devuelven al administrador",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Totales del evento" }, "404": { description: "No existe" } },
      },
    },
```

Y añadir los imports correspondientes al principio del archivo:

```ts
import { categoriaSchema, metodoPagoSchema } from "../schemas/catalogo.schema.js";
import {
  candadoSchema,
  descuentoSchema,
  eventoSchema,
  lineaSchema,
} from "../schemas/evento.schema.js";
import { ventaSchema } from "../schemas/venta.schema.js";
```

- [ ] **Step 4: Ejecutar la suite completa y la verificación de tipos**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS — todo verde, sin errores de tipos, y compila.

- [ ] **Step 5: Commit**

```bash
git add Backend
git commit -m "docs(backend): documentar los endpoints del dominio de ventas"
```

---

## Verificación final del plan

Al terminar la Task 10, deben cumplirse todas estas condiciones (ejecutar desde `Backend/`):

- [ ] `npm test` pasa completo (unas 85 pruebas).
- [ ] `npm run typecheck` no reporta errores, incluidas las pruebas.
- [ ] `npm run build` compila.
- [ ] Ningún archivo fuera de `src/repositories/` importa Prisma:

```bash
grep -rn "PrismaClient\|infra/prisma" src --include=*.ts | grep -v "^src/repositories\|^src/infra"
```

  Expected: sin resultados.

- [ ] Siguen existiendo exactamente **dos** funciones con sufijo `Global`:

```bash
grep -rn "Global(" src --include=*.ts | grep -v test
```

  Expected: solo `buscarPorEmailGlobal` y `buscarPorIdGlobal`, ambas en `usuario.repository.ts`.

- [ ] No hay flotantes en el dinero: ningún `Float` ni `Decimal` en `prisma/schema.prisma`.
- [ ] `GET /docs` muestra los endpoints del dominio, todos con el candado de autenticación.
