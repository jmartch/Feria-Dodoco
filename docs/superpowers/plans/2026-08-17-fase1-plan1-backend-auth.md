# Fase 1 · Plan 1 — Backend: fundamentos, autenticación y aislamiento multi-tenant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el backend en TypeScript con registro y login de emprendimientos, y con el aislamiento entre emprendimientos demostrado por pruebas que intentan leer datos ajenos y fallan.

**Architecture:** Express con capas estrictas `routes → controllers → services → repositories → Prisma → MySQL`. La capa de repositorios es el único punto que toca la base de datos y exige siempre `emprendimientoId`; ningún controlador importa Prisma. Esta capa sustituye al RLS que MySQL no ofrece, por lo que sus pruebas de fuga son parte del entregable, no un extra.

**Tech Stack:** Node 20+, TypeScript, Express 5, Prisma, MySQL 8 (Docker en local, Railway en producción), Vitest, Supertest, Zod, argon2, jsonwebtoken, helmet, cors, express-rate-limit, swagger-ui-express.

## Global Constraints

- Todo el código en **TypeScript estricto** (`strict: true`). Sin `any` implícito.
- **El dinero se guarda como entero de pesos.** Nunca `Float` ni `Decimal` para montos.
- **Ningún archivo fuera de `src/repositories/` importa `PrismaClient`.** Los controladores nunca consultan la base de datos.
- **Toda función de repositorio que lea o escriba datos de un emprendimiento recibe `scope: Scope` como primer parámetro.** Existen exactamente **dos excepciones documentadas**, ambas en `usuario.repository.ts`, y ninguna más puede añadirse sin actualizar esta lista:
  1. `buscarPorEmailGlobal` — para el login: en ese momento aún no se sabe a qué emprendimiento pertenece quien entra.
  2. `buscarPorIdGlobal` — para renovar la sesión: el refresh token identifica al usuario antes de conocer su emprendimiento.

  Ambas llevan el sufijo `Global` justamente para que salten a la vista en una revisión, y solo el servicio de autenticación puede llamarlas.
- Contraseñas con **argon2id**. Jamás se registran ni se devuelven contraseñas ni hashes.
- **Toda entrada validada con Zod** antes de llegar al servicio.
- Mensajes de error **en español**, sin filtrar detalles internos ni indicar si un email existe.
- Todos los identificadores son **UUID en texto**, generados por la aplicación.
- El backend es **ESM** (`"type": "module"`). Por eso los imports internos llevan extensión
  `.js` aunque el archivo fuente sea `.ts`: lo exige Node en ESM con
  `moduleResolution: "NodeNext"`. No es un error de tipeo.
- **Prisma queda fijado en la rama 6.x** (`^6.19.3` en `prisma` y `@prisma/client`).
  Prisma 7 retira `url = env("DATABASE_URL")` dentro de `datasource` y exige
  `prisma.config.ts` más driver adapters, lo que obligaría a reescribir el esquema y el
  cliente. No subir a 7.x dentro de este plan: es una migración deliberada, no un bump.

---

### Task 1: Esqueleto del backend y endpoint de salud

**Files:**
- Create: `Backend/package.json`
- Create: `Backend/tsconfig.json`
- Create: `Backend/vitest.config.ts`
- Create: `Backend/.gitignore`
- Create: `Backend/src/app.ts`
- Create: `Backend/src/server.ts`
- Test: `Backend/test/health.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: `createApp(): Express` desde `src/app.ts`. Todas las tareas siguientes montan sus rutas sobre esta función y las pruebas de integración la usan con Supertest.

- [ ] **Step 1: Inicializar el proyecto e instalar dependencias**

Ejecutar desde `Backend/`:

```bash
npm init -y && npm pkg set type=module && npm i express@^5 && npm i -D typescript @types/node @types/express vitest supertest @types/supertest tsx
```

- [ ] **Step 2: Crear la configuración de TypeScript y Vitest**

`Backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

`Backend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
  },
});
```

`Backend/.gitignore`:

```
node_modules
dist
.env
```

Agregar los scripts en `Backend/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Escribir la prueba que falla**

`Backend/test/health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("GET /health", () => {
  it("responde 200 con estado ok", async () => {
    const respuesta = await request(createApp()).get("/health");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: "ok" });
  });
});
```

- [ ] **Step 4: Ejecutar la prueba y verificar que falla**

Run: `npm test`
Expected: FAIL — no encuentra el módulo `../src/app.js`.

- [ ] **Step 5: Escribir la implementación mínima**

`Backend/src/app.ts`:

```ts
import express, { type Express } from "express";

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ estado: "ok" });
  });

  return app;
}
```

`Backend/src/server.ts`:

```ts
import { createApp } from "./app.js";

const puerto = Number(process.env.PORT ?? 3000);

createApp().listen(puerto, () => {
  console.log(`API escuchando en el puerto ${puerto}`);
});
```

- [ ] **Step 6: Ejecutar la prueba y verificar que pasa**

Run: `npm test`
Expected: PASS — 1 prueba.

- [ ] **Step 7: Commit**

```bash
git add Backend
git commit -m "feat(backend): esqueleto Express con endpoint de salud"
```

---

### Task 2: Base de datos MySQL y esquema base

**Files:**
- Create: `Backend/docker-compose.yml`
- Create: `Backend/.env.example`
- Create: `Backend/prisma/schema.prisma`
- Create: `Backend/src/infra/prisma.ts`
- Create: `Backend/test/helpers/db.ts`
- Test: `Backend/test/esquema.test.ts`

**Interfaces:**
- Consumes: nada del código anterior.
- Produces: `prisma` (instancia de `PrismaClient`) desde `src/infra/prisma.ts`, de uso exclusivo dentro de `src/repositories/`. `limpiarBaseDeDatos(): Promise<void>` desde `test/helpers/db.ts`, que las pruebas de tareas siguientes llaman en `beforeEach`.

- [ ] **Step 1: Instalar Prisma y levantar MySQL local**

```bash
npm i @prisma/client && npm i -D prisma
```

`Backend/docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8
    ports:
      - "3308:3306"
    environment:
      MYSQL_ROOT_PASSWORD: dodoco
      MYSQL_DATABASE: dodoco
    volumes:
      - dodoco_mysql:/var/lib/mysql

volumes:
  dodoco_mysql:
```

`Backend/.env.example`:

```
DATABASE_URL="mysql://root:dodoco@localhost:3308/dodoco"
JWT_ACCESS_SECRET="cambiar-en-produccion"
# Reservado: hoy el refresh token es aleatorio y se guarda hasheado con SHA-256,
# asi que esta variable aun no se usa. Se deja declarada para no cambiar la
# configuracion de Railway cuando se firme el refresh como JWT.
JWT_REFRESH_SECRET="cambiar-en-produccion-tambien"
CORS_ORIGIN="http://localhost:5173"
```

Copiar `.env.example` a `.env` y levantar la base:

```bash
cp .env.example .env && docker compose up -d
```

- [ ] **Step 2: Definir el esquema**

`Backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Rol {
  ADMIN
  VENDEDOR
}

model Emprendimiento {
  id             String    @id
  nombre         String
  logo           String?   @db.Text
  metaPorDefecto Int       @default(1000000)
  creadoEn       DateTime  @default(now())
  usuarios       Usuario[]
}

model Usuario {
  id               String         @id
  email            String         @unique
  passwordHash     String
  nombre           String
  rol              Rol            @default(VENDEDOR)
  emprendimientoId String
  emprendimiento   Emprendimiento @relation(fields: [emprendimientoId], references: [id], onDelete: Cascade)
  creadoEn         DateTime       @default(now())

  @@index([emprendimientoId])
}
```

Nota: `metaPorDefecto` es un entero de pesos, según las restricciones globales.

- [ ] **Step 3: Crear la migración**

Run: `npx prisma migrate dev --name esquema-base`
Expected: crea `Backend/prisma/migrations/` y genera el cliente de Prisma.

- [ ] **Step 4: Escribir la prueba que falla**

`Backend/src/infra/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

`Backend/test/helpers/db.ts`:

```ts
import { prisma } from "../../src/infra/prisma.js";

export async function limpiarBaseDeDatos(): Promise<void> {
  await prisma.usuario.deleteMany();
  await prisma.emprendimiento.deleteMany();
}
```

`Backend/test/esquema.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("esquema base", () => {
  it("guarda un emprendimiento junto con su usuario admin", async () => {
    const emprendimiento = await prisma.emprendimiento.create({
      data: {
        id: randomUUID(),
        nombre: "Dodoco Store",
        usuarios: {
          create: {
            id: randomUUID(),
            email: "admin@dodoco.co",
            passwordHash: "hash-de-prueba",
            nombre: "Juan",
            rol: "ADMIN",
          },
        },
      },
      include: { usuarios: true },
    });

    expect(emprendimiento.metaPorDefecto).toBe(1000000);
    expect(emprendimiento.usuarios).toHaveLength(1);
    expect(emprendimiento.usuarios[0].rol).toBe("ADMIN");
  });

  it("no permite dos usuarios con el mismo email", async () => {
    const crear = (email: string) =>
      prisma.emprendimiento.create({
        data: {
          id: randomUUID(),
          nombre: "Tienda",
          usuarios: {
            create: { id: randomUUID(), email, passwordHash: "h", nombre: "N" },
          },
        },
      });

    await crear("repetido@dodoco.co");

    await expect(crear("repetido@dodoco.co")).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Ejecutar las pruebas y verificar que pasan**

Run: `npm test`
Expected: PASS — 3 pruebas en total (incluye la de salud).

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): MySQL con Prisma y esquema de emprendimiento y usuario"
```

---

### Task 3: Capa de repositorios con aislamiento obligatorio

Esta es la tarea que sustituye al RLS. El objetivo del entregable es que sea **imposible por construcción** escribir una consulta de negocio sin indicar el emprendimiento.

**Files:**
- Create: `Backend/src/repositories/scope.ts`
- Create: `Backend/src/repositories/usuario.repository.ts`
- Create: `Backend/src/repositories/emprendimiento.repository.ts`
- Test: `Backend/test/aislamiento.test.ts`

**Interfaces:**
- Consumes: `prisma` de `src/infra/prisma.ts`; `limpiarBaseDeDatos()` de `test/helpers/db.ts`.
- Produces:
  - `type Scope = { emprendimientoId: string }` desde `src/repositories/scope.ts`.
  - `usuarioRepository` con `listar(scope: Scope): Promise<UsuarioSeguro[]>`, `buscarPorId(scope: Scope, id: string): Promise<UsuarioSeguro | null>`, `buscarPorEmailGlobal(email: string): Promise<UsuarioConHash | null>`, `crear(scope: Scope, datos: NuevoUsuario): Promise<UsuarioSeguro>`.
  - `emprendimientoRepository` con `crearConAdmin(datos: NuevoEmprendimiento): Promise<{ emprendimientoId: string; usuario: UsuarioSeguro }>` y `buscarPorId(scope: Scope): Promise<Emprendimiento | null>`.
  - Tipos `UsuarioSeguro` (sin `passwordHash`) y `UsuarioConHash` (con él), exportados desde `src/repositories/usuario.repository.ts`.

- [ ] **Step 1: Escribir la prueba de fuga que falla**

`Backend/test/aislamiento.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { emprendimientoRepository } from "../src/repositories/emprendimiento.repository.js";
import { usuarioRepository } from "../src/repositories/usuario.repository.js";

let empA = "";
let empB = "";
let usuarioDeB = "";

beforeEach(async () => {
  await limpiarBaseDeDatos();

  const a = await emprendimientoRepository.crearConAdmin({
    nombreEmprendimiento: "Dodoco",
    email: "a@dodoco.co",
    passwordHash: "hash-a",
    nombreUsuario: "Ana",
  });
  const b = await emprendimientoRepository.crearConAdmin({
    nombreEmprendimiento: "Medias Pao",
    email: "b@medias.co",
    passwordHash: "hash-b",
    nombreUsuario: "Beto",
  });

  empA = a.emprendimientoId;
  empB = b.emprendimientoId;
  usuarioDeB = b.usuario.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("aislamiento entre emprendimientos", () => {
  it("listar solo devuelve usuarios del emprendimiento del scope", async () => {
    const usuarios = await usuarioRepository.listar({ emprendimientoId: empA });

    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].email).toBe("a@dodoco.co");
  });

  it("no deja leer un usuario de otro emprendimiento aunque se sepa su id", async () => {
    const fuga = await usuarioRepository.buscarPorId(
      { emprendimientoId: empA },
      usuarioDeB,
    );

    expect(fuga).toBeNull();
  });

  it("nunca expone el hash de la contraseña en las lecturas normales", async () => {
    const usuarios = await usuarioRepository.listar({ emprendimientoId: empA });

    expect(usuarios[0]).not.toHaveProperty("passwordHash");
  });

  it("crearConAdmin deja exactamente un admin por emprendimiento", async () => {
    const usuarios = await usuarioRepository.listar({ emprendimientoId: empB });

    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].rol).toBe("ADMIN");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- aislamiento`
Expected: FAIL — no existen los módulos de repositorio.

- [ ] **Step 3: Implementar el scope y los repositorios**

`Backend/src/repositories/scope.ts`:

```ts
/**
 * Identifica al emprendimiento dueño de los datos.
 * Toda operación de negocio contra la base de datos lo exige como primer
 * parámetro. Es lo que sustituye al RLS que MySQL no ofrece.
 */
export type Scope = {
  emprendimientoId: string;
};
```

`Backend/src/repositories/usuario.repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type Rol = "ADMIN" | "VENDEDOR";

export type UsuarioSeguro = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  emprendimientoId: string;
};

export type UsuarioConHash = UsuarioSeguro & {
  passwordHash: string;
};

/**
 * Datos de negocio del usuario. NO incluye `emprendimientoId` a propósito:
 * ese valor entra por `scope`, que sale del token y nunca del cuerpo de la
 * petición. Así es imposible crear un usuario dentro de un emprendimiento ajeno.
 */
export type NuevoUsuario = {
  email: string;
  passwordHash: string;
  nombre: string;
  rol: Rol;
};

/** Campos que se devuelven siempre; excluye passwordHash a propósito. */
const camposSeguros = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  emprendimientoId: true,
} as const;

export const usuarioRepository = {
  async listar(scope: Scope): Promise<UsuarioSeguro[]> {
    return prisma.usuario.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: camposSeguros,
      orderBy: { creadoEn: "asc" },
    });
  },

  async buscarPorId(scope: Scope, id: string): Promise<UsuarioSeguro | null> {
    return prisma.usuario.findFirst({
      where: { id, emprendimientoId: scope.emprendimientoId },
      select: camposSeguros,
    });
  },

  /**
   * Excepción documentada al aislamiento: en el login todavía no se sabe a qué
   * emprendimiento pertenece quien entra. Solo debe usarla el servicio de
   * autenticación, nunca un endpoint de negocio.
   */
  async buscarPorEmailGlobal(email: string): Promise<UsuarioConHash | null> {
    return prisma.usuario.findUnique({
      where: { email },
      select: { ...camposSeguros, passwordHash: true },
    });
  },

  async crear(scope: Scope, datos: NuevoUsuario): Promise<UsuarioSeguro> {
    return prisma.usuario.create({
      // El spread va primero y los campos controlados después: así ni el id ni
      // el emprendimiento pueden ser sobrescritos por quien llama.
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposSeguros,
    });
  },
};
```

`Backend/src/repositories/emprendimiento.repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";
import type { UsuarioSeguro } from "./usuario.repository.js";

export type NuevoEmprendimiento = {
  nombreEmprendimiento: string;
  email: string;
  passwordHash: string;
  nombreUsuario: string;
};

export type Emprendimiento = {
  id: string;
  nombre: string;
  logo: string | null;
  metaPorDefecto: number;
};

export const emprendimientoRepository = {
  /**
   * Crea el emprendimiento y su usuario ADMIN en una sola transacción:
   * nunca debe quedar un emprendimiento sin nadie que pueda entrar.
   */
  async crearConAdmin(
    datos: NuevoEmprendimiento,
  ): Promise<{ emprendimientoId: string; usuario: UsuarioSeguro }> {
    const emprendimientoId = randomUUID();

    const usuario = await prisma.$transaction(async (tx) => {
      await tx.emprendimiento.create({
        data: { id: emprendimientoId, nombre: datos.nombreEmprendimiento },
      });

      return tx.usuario.create({
        data: {
          id: randomUUID(),
          emprendimientoId,
          email: datos.email,
          passwordHash: datos.passwordHash,
          nombre: datos.nombreUsuario,
          rol: "ADMIN",
        },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          emprendimientoId: true,
        },
      });
    });

    return { emprendimientoId, usuario };
  },

  async buscarPorId(scope: Scope): Promise<Emprendimiento | null> {
    return prisma.emprendimiento.findUnique({
      where: { id: scope.emprendimientoId },
      select: { id: true, nombre: true, logo: true, metaPorDefecto: true },
    });
  },
};
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — las 4 pruebas de aislamiento incluidas.

- [ ] **Step 5: Commit**

```bash
git add Backend
git commit -m "feat(backend): capa de repositorios con aislamiento por emprendimiento"
```

---

### Task 4: Registro de emprendimiento con contraseña cifrada

**Files:**
- Create: `Backend/src/services/password.service.ts`
- Create: `Backend/src/services/auth.service.ts`
- Create: `Backend/src/errors.ts`
- Test: `Backend/test/registro.test.ts`

**Interfaces:**
- Consumes: `emprendimientoRepository.crearConAdmin`, `usuarioRepository.buscarPorEmailGlobal`.
- Produces:
  - `hashearPassword(plana: string): Promise<string>` y `verificarPassword(hash: string, plana: string): Promise<boolean>` desde `src/services/password.service.ts`.
  - `authService.registrar(datos: DatosRegistro): Promise<UsuarioSeguro>` desde `src/services/auth.service.ts`, con `DatosRegistro = { nombreEmprendimiento: string; email: string; password: string; nombreUsuario: string }`.
  - `ErrorDeNegocio` (con `codigo: string` y `estado: number`) desde `src/errors.ts`, usado por todos los servicios posteriores.

- [ ] **Step 1: Instalar argon2**

```bash
npm i argon2
```

- [ ] **Step 2: Escribir la prueba que falla**

`Backend/test/registro.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { authService } from "../src/services/auth.service.js";
import { verificarPassword } from "../src/services/password.service.js";

const datos = {
  nombreEmprendimiento: "Dodoco Store",
  email: "admin@dodoco.co",
  password: "clave-segura-123",
  nombreUsuario: "Juan",
};

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("registro de emprendimiento", () => {
  it("crea el emprendimiento con su usuario admin", async () => {
    const usuario = await authService.registrar(datos);

    expect(usuario.rol).toBe("ADMIN");
    expect(usuario.email).toBe("admin@dodoco.co");
    expect(usuario.emprendimientoId).toBeTruthy();
  });

  it("guarda la contraseña cifrada, nunca en texto plano", async () => {
    await authService.registrar(datos);

    const guardado = await prisma.usuario.findUnique({
      where: { email: datos.email },
    });

    expect(guardado?.passwordHash).not.toBe(datos.password);
    expect(guardado?.passwordHash.startsWith("$argon2")).toBe(true);
    await expect(
      verificarPassword(guardado!.passwordHash, datos.password),
    ).resolves.toBe(true);
  });

  it("rechaza un email ya registrado", async () => {
    await authService.registrar(datos);

    await expect(authService.registrar(datos)).rejects.toMatchObject({
      codigo: "EMAIL_YA_REGISTRADO",
    });
  });

  it("no deja el emprendimiento creado si el registro falla", async () => {
    await authService.registrar(datos);

    await authService.registrar({ ...datos }).catch(() => undefined);

    const emprendimientos = await prisma.emprendimiento.count();
    expect(emprendimientos).toBe(1);
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test -- registro`
Expected: FAIL — no existen `auth.service` ni `password.service`.

- [ ] **Step 4: Implementar**

`Backend/src/errors.ts`:

```ts
export class ErrorDeNegocio extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly estado: number = 400,
  ) {
    super(mensaje);
    this.name = "ErrorDeNegocio";
  }
}
```

`Backend/src/services/password.service.ts`:

```ts
import argon2 from "argon2";

export async function hashearPassword(plana: string): Promise<string> {
  return argon2.hash(plana, { type: argon2.argon2id });
}

export async function verificarPassword(
  hash: string,
  plana: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plana);
  } catch {
    return false;
  }
}
```

`Backend/src/services/auth.service.ts`:

```ts
import { ErrorDeNegocio } from "../errors.js";
import { emprendimientoRepository } from "../repositories/emprendimiento.repository.js";
import {
  usuarioRepository,
  type UsuarioSeguro,
} from "../repositories/usuario.repository.js";
import { hashearPassword } from "./password.service.js";

export type DatosRegistro = {
  nombreEmprendimiento: string;
  email: string;
  password: string;
  nombreUsuario: string;
};

export const authService = {
  async registrar(datos: DatosRegistro): Promise<UsuarioSeguro> {
    const email = datos.email.trim().toLowerCase();
    const existente = await usuarioRepository.buscarPorEmailGlobal(email);

    if (existente) {
      throw new ErrorDeNegocio(
        "EMAIL_YA_REGISTRADO",
        "Ese correo ya tiene una cuenta",
        409,
      );
    }

    const passwordHash = await hashearPassword(datos.password);

    const { usuario } = await emprendimientoRepository.crearConAdmin({
      nombreEmprendimiento: datos.nombreEmprendimiento.trim(),
      email,
      passwordHash,
      nombreUsuario: datos.nombreUsuario.trim(),
    });

    return usuario;
  },
};
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 4 pruebas nuevas de registro.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): registro de emprendimiento con argon2"
```

---

### Task 5: Tokens JWT con refresh rotativo

**Files:**
- Modify: `Backend/prisma/schema.prisma` (agregar `RefreshToken`)
- Create: `Backend/src/services/token.service.ts`
- Create: `Backend/src/repositories/refreshToken.repository.ts`
- Modify: `Backend/test/helpers/db.ts`
- Modify: `Backend/src/services/auth.service.ts`
- Test: `Backend/test/tokens.test.ts`

**Interfaces:**
- Consumes: `usuarioRepository.buscarPorEmailGlobal`, `verificarPassword`, `ErrorDeNegocio`.
- Produces:
  - `type Sesion = { accessToken: string; refreshToken: string; usuario: UsuarioSeguro }`.
  - `firmarAccessToken(u: UsuarioSeguro): string` y `verificarAccessToken(token: string): PayloadToken` desde `src/services/token.service.ts`, con `PayloadToken = { sub: string; emprendimientoId: string; rol: Rol }`.
  - `authService.login(email: string, password: string): Promise<Sesion>` y `authService.refrescar(refreshToken: string): Promise<Sesion>`.

- [ ] **Step 1: Instalar dependencias y ampliar el esquema**

```bash
npm i jsonwebtoken && npm i -D @types/jsonwebtoken
```

Agregar a `Backend/prisma/schema.prisma`:

```prisma
model RefreshToken {
  id        String   @id
  tokenHash String   @unique
  usuarioId String
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usadoEn   DateTime?
  expiraEn  DateTime
  creadoEn  DateTime @default(now())

  @@index([usuarioId])
}
```

Y agregar la relación inversa dentro del modelo `Usuario`:

```prisma
  refreshTokens RefreshToken[]
```

Run: `npx prisma migrate dev --name refresh-tokens`

Actualizar `Backend/test/helpers/db.ts` para borrar también los tokens:

```ts
import { prisma } from "../../src/infra/prisma.js";

export async function limpiarBaseDeDatos(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.emprendimiento.deleteMany();
}
```

- [ ] **Step 2: Escribir la prueba que falla**

`Backend/test/tokens.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { authService } from "../src/services/auth.service.js";
import { verificarAccessToken } from "../src/services/token.service.js";

const datos = {
  nombreEmprendimiento: "Dodoco Store",
  email: "admin@dodoco.co",
  password: "clave-segura-123",
  nombreUsuario: "Juan",
};

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await authService.registrar(datos);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("login y tokens", () => {
  it("entrega un access token con el emprendimiento del usuario", async () => {
    const sesion = await authService.login(datos.email, datos.password);
    const payload = verificarAccessToken(sesion.accessToken);

    expect(payload.sub).toBe(sesion.usuario.id);
    expect(payload.emprendimientoId).toBe(sesion.usuario.emprendimientoId);
    expect(payload.rol).toBe("ADMIN");
  });

  it("rechaza la contraseña incorrecta sin revelar si el email existe", async () => {
    await expect(
      authService.login(datos.email, "clave-equivocada"),
    ).rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });

    await expect(
      authService.login("noexiste@dodoco.co", "loquesea"),
    ).rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
  });

  it("rechaza un access token manipulado", () => {
    expect(() => verificarAccessToken("token.falso.aqui")).toThrow();
  });

  it("al refrescar entrega tokens nuevos e invalida el anterior", async () => {
    const primera = await authService.login(datos.email, datos.password);
    const segunda = await authService.refrescar(primera.refreshToken);

    expect(segunda.refreshToken).not.toBe(primera.refreshToken);

    await expect(
      authService.refrescar(primera.refreshToken),
    ).rejects.toMatchObject({ codigo: "REFRESH_INVALIDO" });
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test -- tokens`
Expected: FAIL — no existe `token.service`.

- [ ] **Step 4: Implementar**

`Backend/src/repositories/refreshToken.repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";

export const refreshTokenRepository = {
  async guardar(
    usuarioId: string,
    tokenHash: string,
    expiraEn: Date,
  ): Promise<void> {
    await prisma.refreshToken.create({
      data: { id: randomUUID(), usuarioId, tokenHash, expiraEn },
    });
  },

  async buscarVigente(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, usadoEn: null, expiraEn: { gt: new Date() } },
    });
  },

  async marcarUsado(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { usadoEn: new Date() },
    });
  },
};
```

`Backend/src/services/token.service.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Rol, UsuarioSeguro } from "../repositories/usuario.repository.js";

export type PayloadToken = {
  sub: string;
  emprendimientoId: string;
  rol: Rol;
};

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "secreto-de-desarrollo";
const DURACION_ACCESS = "15m";
export const DIAS_REFRESH = 30;

export function firmarAccessToken(usuario: UsuarioSeguro): string {
  const payload: PayloadToken = {
    sub: usuario.id,
    emprendimientoId: usuario.emprendimientoId,
    rol: usuario.rol,
  };

  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: DURACION_ACCESS });
}

export function verificarAccessToken(token: string): PayloadToken {
  return jwt.verify(token, ACCESS_SECRET) as PayloadToken;
}

/** El refresh token es aleatorio; en la base solo se guarda su hash. */
export function generarRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString("hex");
  return { token, hash: hashearRefresh(token) };
}

export function hashearRefresh(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

Agregar a `Backend/src/services/auth.service.ts` (manteniendo lo ya escrito):

```ts
import { refreshTokenRepository } from "../repositories/refreshToken.repository.js";
import { verificarPassword } from "./password.service.js";
import {
  DIAS_REFRESH,
  firmarAccessToken,
  generarRefreshToken,
  hashearRefresh,
} from "./token.service.js";

export type Sesion = {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioSeguro;
};

async function abrirSesion(usuario: UsuarioSeguro): Promise<Sesion> {
  const { token, hash } = generarRefreshToken();
  const expiraEn = new Date(Date.now() + DIAS_REFRESH * 24 * 60 * 60 * 1000);

  await refreshTokenRepository.guardar(usuario.id, hash, expiraEn);

  return {
    accessToken: firmarAccessToken(usuario),
    refreshToken: token,
    usuario,
  };
}
```

Y añadir estos dos métodos al objeto `authService`:

```ts
  async login(email: string, password: string): Promise<Sesion> {
    const credencialesInvalidas = new ErrorDeNegocio(
      "CREDENCIALES_INVALIDAS",
      "Correo o contraseña incorrectos",
      401,
    );

    const usuario = await usuarioRepository.buscarPorEmailGlobal(
      email.trim().toLowerCase(),
    );
    if (!usuario) throw credencialesInvalidas;

    const coincide = await verificarPassword(usuario.passwordHash, password);
    if (!coincide) throw credencialesInvalidas;

    const { passwordHash: _descartado, ...seguro } = usuario;
    return abrirSesion(seguro);
  },

  async refrescar(refreshToken: string): Promise<Sesion> {
    const guardado = await refreshTokenRepository.buscarVigente(
      hashearRefresh(refreshToken),
    );

    if (!guardado) {
      throw new ErrorDeNegocio(
        "REFRESH_INVALIDO",
        "La sesión expiró, vuelve a entrar",
        401,
      );
    }

    await refreshTokenRepository.marcarUsado(guardado.id);

    const usuario = await usuarioRepository.buscarPorIdGlobal(
      guardado.usuarioId,
    );
    if (!usuario) {
      throw new ErrorDeNegocio(
        "REFRESH_INVALIDO",
        "La sesión expiró, vuelve a entrar",
        401,
      );
    }

    return abrirSesion(usuario);
  },
```

Agregar a `usuarioRepository` el método que necesita `refrescar` (segunda y última excepción documentada al scope, porque el refresh token identifica al usuario antes de conocer su emprendimiento):

```ts
  /** Excepción documentada: solo para renovar sesión a partir de un refresh token válido. */
  async buscarPorIdGlobal(id: string): Promise<UsuarioSeguro | null> {
    return prisma.usuario.findUnique({ where: { id }, select: camposSeguros });
  },
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 4 pruebas nuevas de tokens.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): login con JWT y refresh token rotativo"
```

---

### Task 6: Middlewares de seguridad y manejo de errores

**Files:**
- Create: `Backend/src/middlewares/autenticar.ts`
- Create: `Backend/src/middlewares/validar.ts`
- Create: `Backend/src/middlewares/manejarErrores.ts`
- Create: `Backend/src/middlewares/limites.ts`
- Modify: `Backend/src/app.ts`
- Test: `Backend/test/middlewares.test.ts`

**Interfaces:**
- Consumes: `verificarAccessToken`, `ErrorDeNegocio`.
- Produces:
  - `autenticar` (middleware) que deja `req.auth = { usuarioId, emprendimientoId, rol }`.
  - `soloAdmin` (middleware) que responde 403 si el rol no es `ADMIN`.
  - `validar(esquema: ZodSchema)` (middleware) que valida `req.body`.
  - `manejarErrores` (middleware de error) que traduce `ErrorDeNegocio` a su `estado` y cualquier otro error a 500.
  - `limiteGeneral` y `limiteLogin` (rate limiters).
  - Tipo global `Express.Request.auth` declarado en `src/middlewares/autenticar.ts`.

- [ ] **Step 1: Instalar dependencias**

```bash
npm i zod@^4 helmet cors express-rate-limit && npm i -D @types/cors
```

- [ ] **Step 2: Escribir la prueba que falla**

`Backend/test/middlewares.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { autenticar, soloAdmin } from "../src/middlewares/autenticar.js";
import { validar } from "../src/middlewares/validar.js";
import { manejarErrores } from "../src/middlewares/manejarErrores.js";
import { firmarAccessToken } from "../src/services/token.service.js";

function appDePrueba() {
  const app = express();
  app.use(express.json());

  app.get("/privado", autenticar, (req, res) => {
    res.json({ emprendimientoId: req.auth!.emprendimientoId });
  });

  app.get("/solo-admin", autenticar, soloAdmin, (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/validado",
    validar(z.object({ nombre: z.string().min(1) })),
    (_req, res) => res.json({ ok: true }),
  );

  app.use(manejarErrores);
  return app;
}

const vendedor = {
  id: "u1",
  email: "v@d.co",
  nombre: "Vendedor",
  rol: "VENDEDOR" as const,
  emprendimientoId: "emp-1",
};

describe("middlewares", () => {
  it("rechaza sin token con 401", async () => {
    const res = await request(appDePrueba()).get("/privado");

    expect(res.status).toBe(401);
  });

  it("acepta con token válido y expone el emprendimiento", async () => {
    const token = firmarAccessToken(vendedor);

    const res = await request(appDePrueba())
      .get("/privado")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.emprendimientoId).toBe("emp-1");
  });

  it("bloquea a un vendedor en una ruta de admin con 403", async () => {
    const token = firmarAccessToken(vendedor);

    const res = await request(appDePrueba())
      .get("/solo-admin")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("devuelve 400 en español cuando el cuerpo es inválido", async () => {
    const res = await request(appDePrueba()).post("/validado").send({});

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("DATOS_INVALIDOS");
    expect(Array.isArray(res.body.detalles)).toBe(true);
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test -- middlewares`
Expected: FAIL — no existen los middlewares.

- [ ] **Step 4: Implementar**

`Backend/src/middlewares/autenticar.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { verificarAccessToken } from "../services/token.service.js";
import type { Rol } from "../repositories/usuario.repository.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { usuarioId: string; emprendimientoId: string; rol: Rol };
    }
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization ?? "";
  const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : "";

  if (!token) {
    res.status(401).json({ codigo: "NO_AUTENTICADO", mensaje: "Debes iniciar sesión" });
    return;
  }

  try {
    const payload = verificarAccessToken(token);
    req.auth = {
      usuarioId: payload.sub,
      emprendimientoId: payload.emprendimientoId,
      rol: payload.rol,
    };
    next();
  } catch {
    res.status(401).json({ codigo: "SESION_EXPIRADA", mensaje: "La sesión expiró" });
  }
}

export function soloAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.rol !== "ADMIN") {
    res.status(403).json({ codigo: "SIN_PERMISO", mensaje: "Solo el administrador puede hacer esto" });
    return;
  }
  next();
}
```

`Backend/src/middlewares/validar.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export function validar(esquema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const resultado = esquema.safeParse(req.body);

    if (!resultado.success) {
      res.status(400).json({
        codigo: "DATOS_INVALIDOS",
        mensaje: "Revisa los datos enviados",
        detalles: resultado.error.issues.map((i) => ({
          campo: i.path.join("."),
          problema: i.message,
        })),
      });
      return;
    }

    req.body = resultado.data;
    next();
  };
}
```

`Backend/src/middlewares/manejarErrores.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";

export function manejarErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ErrorDeNegocio) {
    res.status(error.estado).json({ codigo: error.codigo, mensaje: error.message });
    return;
  }

  console.error("Error no controlado:", error);
  res.status(500).json({ codigo: "ERROR_INTERNO", mensaje: "Algo salió mal" });
}
```

`Backend/src/middlewares/limites.ts`:

```ts
import rateLimit from "express-rate-limit";

export const limiteGeneral = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { codigo: "DEMASIADAS_PETICIONES", mensaje: "Espera un momento" },
});

/** Más estricto: frena la fuerza bruta contra el login. */
export const limiteLogin = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { codigo: "DEMASIADOS_INTENTOS", mensaje: "Demasiados intentos, espera 15 minutos" },
});
```

Actualizar `Backend/src/app.ts`:

```ts
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { limiteGeneral } from "./middlewares/limites.js";
import { manejarErrores } from "./middlewares/manejarErrores.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(limiteGeneral);

  app.get("/health", (_req, res) => {
    res.json({ estado: "ok" });
  });

  app.use(manejarErrores);
  return app;
}
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 4 pruebas nuevas de middlewares.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "feat(backend): middlewares de auth, validacion, limites y errores"
```

---

### Task 7: Rutas de autenticación

**Files:**
- Create: `Backend/src/schemas/auth.schema.ts`
- Create: `Backend/src/controllers/auth.controller.ts`
- Create: `Backend/src/routes/auth.routes.ts`
- Modify: `Backend/src/app.ts`
- Test: `Backend/test/auth.routes.test.ts`

**Interfaces:**
- Consumes: `authService.registrar`, `authService.login`, `authService.refrescar`, `autenticar`, `validar`, `limiteLogin`, `usuarioRepository.buscarPorId`.
- Produces: rutas `POST /auth/registro`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/yo`, montadas en `createApp()`. Los esquemas `registroSchema`, `loginSchema` y `refreshSchema` quedan exportados para reutilizarse en la documentación de la Task 8.

> **Cuidado con el límite de intentos en las pruebas:** `limiteLogin` permite 10 peticiones
> por ventana y `createApp()` se llama una sola vez en el archivo de prueba, así que el
> contador se comparte entre todos los casos. Las 5 pruebas suman 6 peticiones a
> `/auth/registro` y `/auth/login`. Si agregas más casos y empiezas a ver respuestas 429,
> no es un fallo real: crea una app nueva por prueba o sube el límite mediante variable de
> entorno.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/auth.routes.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { createApp } from "../src/app.js";

const app = createApp();

const cuerpoRegistro = {
  nombreEmprendimiento: "Dodoco Store",
  email: "admin@dodoco.co",
  password: "clave-segura-123",
  nombreUsuario: "Juan",
};

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de autenticación", () => {
  it("registra y devuelve el usuario sin datos sensibles", async () => {
    const res = await request(app).post("/auth/registro").send(cuerpoRegistro);

    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe("ADMIN");
    expect(res.body.usuario).not.toHaveProperty("passwordHash");
  });

  it("rechaza el registro con datos inválidos", async () => {
    const res = await request(app)
      .post("/auth/registro")
      .send({ ...cuerpoRegistro, email: "no-es-un-correo" });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("DATOS_INVALIDOS");
  });

  it("permite iniciar sesión y consultar el perfil propio", async () => {
    await request(app).post("/auth/registro").send(cuerpoRegistro);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: cuerpoRegistro.email, password: cuerpoRegistro.password });

    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();

    const yo = await request(app)
      .get("/auth/yo")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(yo.status).toBe(200);
    expect(yo.body.email).toBe(cuerpoRegistro.email);
  });

  it("devuelve 401 con credenciales incorrectas", async () => {
    await request(app).post("/auth/registro").send(cuerpoRegistro);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: cuerpoRegistro.email, password: "equivocada" });

    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe("CREDENCIALES_INVALIDAS");
  });

  it("exige token para el perfil", async () => {
    const res = await request(app).get("/auth/yo");

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- auth.routes`
Expected: FAIL — 404 en `/auth/registro`.

- [ ] **Step 3: Implementar**

`Backend/src/schemas/auth.schema.ts`:

```ts
import { z } from "zod";

export const registroSchema = z.object({
  nombreEmprendimiento: z.string().min(2, "Escribe el nombre del emprendimiento"),
  nombreUsuario: z.string().min(2, "Escribe tu nombre"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Falta el token"),
});
```

`Backend/src/controllers/auth.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { usuarioRepository } from "../repositories/usuario.repository.js";

export const authController = {
  async registrar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = await authService.registrar(req.body);
      res.status(201).json({ usuario });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const sesion = await authService.login(req.body.email, req.body.password);
      res.json(sesion);
    } catch (error) {
      next(error);
    }
  },

  async refrescar(req: Request, res: Response, next: NextFunction) {
    try {
      const sesion = await authService.refrescar(req.body.refreshToken);
      res.json(sesion);
    } catch (error) {
      next(error);
    }
  },

  async yo(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = await usuarioRepository.buscarPorId(
        { emprendimientoId: req.auth!.emprendimientoId },
        req.auth!.usuarioId,
      );
      res.json(usuario);
    } catch (error) {
      next(error);
    }
  },
};
```

`Backend/src/routes/auth.routes.ts`:

```ts
import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { validar } from "../middlewares/validar.js";
import { autenticar } from "../middlewares/autenticar.js";
import { limiteLogin } from "../middlewares/limites.js";
import { loginSchema, refreshSchema, registroSchema } from "../schemas/auth.schema.js";

export const authRoutes = Router();

authRoutes.post("/registro", limiteLogin, validar(registroSchema), authController.registrar);
authRoutes.post("/login", limiteLogin, validar(loginSchema), authController.login);
authRoutes.post("/refresh", validar(refreshSchema), authController.refrescar);
authRoutes.get("/yo", autenticar, authController.yo);
```

Montar las rutas en `Backend/src/app.ts`, justo antes de `app.use(manejarErrores)`:

```ts
import { authRoutes } from "./routes/auth.routes.js";
// ...
  app.use("/auth", authRoutes);
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 5 pruebas nuevas de rutas.

- [ ] **Step 5: Commit**

```bash
git add Backend
git commit -m "feat(backend): rutas de registro, login, refresh y perfil"
```

---

### Task 8: Documentación de la API con Swagger

**Files:**
- Create: `Backend/src/docs/openapi.ts`
- Modify: `Backend/src/app.ts`
- Test: `Backend/test/docs.test.ts`

**Interfaces:**
- Consumes: `registroSchema`, `loginSchema`, `refreshSchema`.
- Produces: `documentoOpenApi` desde `src/docs/openapi.ts` y la ruta `GET /docs`. Las tareas del Plan 2 agregan sus endpoints a este mismo documento.

- [ ] **Step 1: Instalar dependencias**

```bash
npm i swagger-ui-express zod-openapi@^5 && npm i -D @types/swagger-ui-express
```

- [ ] **Step 2: Escribir la prueba que falla**

`Backend/test/docs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("documentación de la API", () => {
  it("publica el documento OpenAPI con los endpoints de auth", async () => {
    const res = await request(createApp()).get("/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths)).toContain("/auth/login");
    expect(Object.keys(res.body.paths)).toContain("/auth/registro");
  });

  it("sirve la interfaz de Swagger", async () => {
    const res = await request(createApp()).get("/docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger");
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test -- docs`
Expected: FAIL — 404 en `/docs.json`.

- [ ] **Step 4: Implementar**

`Backend/src/docs/openapi.ts`:

```ts
import { createDocument } from "zod-openapi";
import { loginSchema, refreshSchema, registroSchema } from "../schemas/auth.schema.js";

export const documentoOpenApi = createDocument({
  openapi: "3.1.0",
  info: {
    title: "API Registro de Ventas",
    version: "1.0.0",
    description:
      "API para registro de ventas en ferias. Todos los montos son enteros de pesos colombianos.",
  },
  paths: {
    "/auth/registro": {
      post: {
        summary: "Crear un emprendimiento con su usuario administrador",
        requestBody: { content: { "application/json": { schema: registroSchema } } },
        responses: {
          "201": { description: "Emprendimiento creado" },
          "400": { description: "Datos inválidos" },
          "409": { description: "El correo ya tiene cuenta" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Iniciar sesión",
        requestBody: { content: { "application/json": { schema: loginSchema } } },
        responses: {
          "200": { description: "Sesión iniciada" },
          "401": { description: "Credenciales inválidas" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Renovar la sesión con un refresh token",
        requestBody: { content: { "application/json": { schema: refreshSchema } } },
        responses: {
          "200": { description: "Sesión renovada" },
          "401": { description: "Refresh token inválido o ya usado" },
        },
      },
    },
    "/auth/yo": {
      get: {
        summary: "Perfil del usuario autenticado",
        responses: {
          "200": { description: "Datos del usuario" },
          "401": { description: "No autenticado" },
        },
      },
    },
  },
});
```

Agregar en `Backend/src/app.ts`, antes de `app.use(manejarErrores)`:

```ts
import swaggerUi from "swagger-ui-express";
import { documentoOpenApi } from "./docs/openapi.js";
// ...
  app.get("/docs.json", (_req, res) => {
    res.json(documentoOpenApi);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(documentoOpenApi));
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS — 2 pruebas nuevas de documentación.

- [ ] **Step 6: Commit**

```bash
git add Backend
git commit -m "docs(backend): documentacion OpenAPI con Swagger UI"
```

---

### Task 9: Preparar el despliegue en Railway

**Files:**
- Create: `Backend/railway.json`
- Create: `Backend/README.md`
- Modify: `Backend/package.json`
- Test: `Backend/test/produccion.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: comando `npm run start:prod` que aplica migraciones y arranca el servidor compilado. Nada de código lo consume; es el entregable de despliegue.

- [ ] **Step 1: Escribir la prueba que falla**

`Backend/test/produccion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const paquete = JSON.parse(readFileSync("package.json", "utf8"));

describe("configuración de producción", () => {
  it("define el comando de arranque que aplica migraciones", () => {
    expect(paquete.scripts["start:prod"]).toContain("prisma migrate deploy");
    expect(paquete.scripts["start:prod"]).toContain("node dist/server.js");
  });

  it("no expone secretos por defecto en el código", () => {
    const tokenService = readFileSync("src/services/token.service.ts", "utf8");

    expect(tokenService).toContain("process.env.JWT_ACCESS_SECRET");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- produccion`
Expected: FAIL — no existe el script `start:prod`.

- [ ] **Step 3: Implementar**

Agregar el script en `Backend/package.json`:

```json
{
  "scripts": {
    "start:prod": "npx prisma migrate deploy && node dist/server.js"
  }
}
```

`Backend/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npx prisma generate && npm run build"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

`Backend/README.md`:

```markdown
# Backend — Registro de ventas

API en Express + Prisma + MySQL.

## Desarrollo local

1. `cp .env.example .env`
2. `docker compose up -d` (levanta MySQL en el puerto 3308)
3. `npx prisma migrate dev`
4. `npm run dev`

La documentación queda en http://localhost:3000/docs

## Pruebas

`npm test` — requiere que MySQL esté arriba.

## Variables de entorno en Railway

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de MySQL |
| `JWT_ACCESS_SECRET` | Secreto del token de acceso |
| `JWT_REFRESH_SECRET` | Secreto reservado para el refresh |
| `CORS_ORIGIN` | URL del frontend en Vercel |
```

- [ ] **Step 4: Ejecutar toda la suite y la verificación de tipos**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS — todas las pruebas pasan, sin errores de tipos y compila.

- [ ] **Step 5: Commit**

```bash
git add Backend
git commit -m "chore(backend): configuracion de despliegue en Railway"
```

---

## Verificación final del plan

Al terminar la Task 9, deben cumplirse todas estas condiciones (ejecutar desde `Backend/`):

- [ ] `npm test` pasa completo (24 pruebas aproximadamente).
- [ ] `npm run typecheck` no reporta errores.
- [ ] Las 4 pruebas de `test/aislamiento.test.ts` pasan: es la garantía que sustituye al RLS.
- [ ] Ningún archivo fuera de `src/repositories/` importa Prisma. Verificar con:

```bash
grep -rn "PrismaClient\|infra/prisma" src --include=*.ts | grep -v "^src/repositories\|^src/infra"
```

  Expected: sin resultados. Si aparece alguno, la garantía de aislamiento está rota y hay
  que mover esa consulta a un repositorio.
- [ ] `GET /docs` muestra la documentación de los cuatro endpoints de autenticación.
