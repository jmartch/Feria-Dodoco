# Diseño — Fase 1: Registro de ventas para ferias

**Fecha:** 2026-08-17
**Estado:** Aprobado, pendiente de plan de implementación

## 1. Contexto

La versión actual es una calculadora estática (HTML/CSS/JS vanilla) que se usó en una
feria real y resultó útil. A partir de esa validación se convierte en un aplicativo web
multi-emprendimiento, instalable como ícono en el celular.

Lo que existe hoy y debe conservarse: cálculo de subtotales en vivo, métodos de pago con
comisión, monto recibido y cambio, registro de ventas del día, totales por método y
exportación. Lo que se agrega: cuentas de usuario, varios eventos simultáneos, catálogo
propio de cada emprendimiento y sincronización con una base de datos.

**Este es un registro de ventas, no un sistema de inventario.** Un emprendimiento puede
tener 100 referencias de medias que se venden todas al mismo precio; obligarlo a
distinguirlas durante una feria de movimiento constante lo haría inservible.

## 2. Alcance

El proyecto se divide en tres fases. Este documento especifica **únicamente la Fase 1**.

| Fase | Contenido |
|---|---|
| **1 (este spec)** | Auth · Evento · Líneas del evento con candado · Ventas · Comisiones configurables · Descuentos · Panel del día · PWA offline |
| 2 | Módulo de Gastos por categoría · Informes del evento e histórico entre eventos |
| 3 | Gestión de usuarios · Notificaciones de nuevas ventas al administrador · Plantillas |

### Fuera de alcance en Fase 1

Gastos, informes históricos, notificaciones push, invitación de usuarios desde la interfaz
y plantillas como entidad propia (el catálogo ya cumple ese papel).

## 3. Stack

| Capa | Tecnología | Despliegue |
|---|---|---|
| Frontend | React + Vite + TypeScript, PWA | Vercel |
| Backend | Express + Prisma + TypeScript | Railway |
| Base de datos | MySQL | Railway |
| Almacenamiento local | IndexedDB (Dexie) | — |

## 4. Decisiones y alternativas descartadas

### 4.1 Offline-first (decisión estructural)

En una feria el internet falla o va lentísimo. La versión actual funciona 100% sin
conexión; si la nueva exigiera red para registrar una venta, sería un retroceso: dejarían
de poder cobrar. Por eso el funcionamiento sin conexión es requisito, no mejora.

**Enfoque elegido: local-first con cola de envío.** Cada venta se guarda primero en el
dispositivo y una cola la envía en segundo plano. La aplicación se comporta igual con o
sin señal: una sola ruta de código, sin esperas visibles.

Descartados: *online-first con respaldo offline* (deja al vendedor esperando en redes
lentas y duplica los caminos de código) y *replicación bidireccional tipo CRDT/RxDB*
(maquinaria pesada para un problema donde las ventas solo se agregan y no hay conflictos
reales).

### 4.2 MySQL sin RLS — decisión consciente

Se solicitó RLS (Row Level Security), pero **RLS es una característica de PostgreSQL y
MySQL no tiene equivalente real**. Se evaluó cambiar a PostgreSQL en Railway; se decidió
conservar MySQL y aislar por código.

Consecuencia aceptada: la separación entre emprendimientos depende del código, no del
motor. Se mitiga con dos medidas obligatorias:

1. **Una única capa de repositorios** es el solo lugar que toca la base de datos, y toda
   consulta exige `emprendimientoId`. Ningún controlador consulta Prisma directamente.
2. **Pruebas de fuga entre emprendimientos** que intentan leer datos ajenos y deben fallar.

### 4.3 Roles y organización

El emprendimiento es la entidad dueña de los datos; bajo él hay usuarios con rol `ADMIN`
o `VENDEDOR`. La separación se mantiene simple: en estos negocios el vendedor suele ser el
mismo dueño.

Escenario que guía el diseño: **un emprendimiento con dos eventos simultáneos**, una
persona en uno y otras personas en otro. Por eso varios eventos pueden estar activos a la
vez y cada venta queda atada a su evento y a quien la registró.

### 4.4 La unidad vendible es la línea de precio

Casi siempre esa línea es la **categoría** ("Medias — $15.000"). El catálogo de productos
existe para quien sí distingue referencias, pero es opcional.

Al armar un evento **se agrega lo que se lleva**, nunca se borra lo que no: partir de 100
referencias y eliminar 70 es impracticable. Se puede traer una categoría completa como una
sola línea con un toque.

Costo aceptado: vendiendo por categoría no se sabe cuál referencia se vendió, solo cuántas
unidades de esa categoría. Es correcto para un registro de ventas; quien necesite el
detalle sube esa referencia como línea propia del evento.

### 4.5 Visibilidad de las comisiones

Requisito previo: la comisión no debe mostrarse al vendedor porque lo confunde.
Requisito nuevo: mostrar el total restando comisiones. Se resuelve con los roles:

- **Vendedor**: en la pantalla de venta solo el total que cobra el cliente; en el panel ve
  la barra de la meta y el acumulado por método, porque la meta es el abono que le
  corresponde y necesita verla.
- **Administrador**: además, comisiones y neto real.

## 5. Modelo de datos

| Tabla | Campos clave |
|---|---|
| `Emprendimiento` | nombre, logo, metaPorDefecto |
| `Usuario` | email, passwordHash, rol (`ADMIN`/`VENDEDOR`), emprendimientoId |
| `Categoria` | nombre, **precio**, emprendimientoId |
| `Producto` | nombre, precioSugerido, categoriaId. Opcional: solo para quien distingue referencias |
| `MetodoPago` | nombre, comisionPct, activo, emprendimientoId |
| `Evento` | nombre, fechaInicio, fechaFin, meta, `catalogoBloqueado`, estado (`ACTIVO`/`CERRADO`) |
| `EventoItem` | eventoId, nombre, precio, origenTipo (`CATEGORIA`/`PRODUCTO`/`MANUAL`), origenId |
| `Descuento` | eventoId, nombre, porcentaje, activo |
| `Venta` | **uuid**, eventoId, usuarioId, subtotal, descuentoNombre, descuentoPct, descuentoValor, total, metodoPagoNombre, comisionPct, comisionValor, neto, recibido, cambio, creadaEnDispositivo, recibidaEnServidor |
| `VentaItem` | ventaId, nombre, precioUnitario, cantidad, subtotal |

Reservadas para fases posteriores, no se construyen ahora: `CategoriaGasto`, `Gasto`,
`Notificacion`.

### Reglas del modelo

1. **La venta guarda fotos del momento, no referencias.** Almacena precio, porcentaje de
   comisión y porcentaje de descuento tal como estaban al vender. Cambiar un precio o una
   tarifa después no debe reescribir el pasado.
2. **El dinero se guarda como entero de pesos.** En COP no se usan centavos y los flotantes
   producen errores de un peso al cuadrar caja. La comisión se redondea a peso entero.
3. **`Venta.uuid` es único.** Es la llave de idempotencia: reintentar un envío nunca
   duplica una venta.
4. **`emprendimientoId` está en todas las tablas**, incluso donde sería deducible, para que
   el filtro de la capa de repositorios sea directo y auditable.
5. **`Evento.catalogoBloqueado`** es el candado: se arma la tabla de líneas, se cierra, y
   nadie cambia precios sin querer durante la feria.
6. **Crear un emprendimiento crea su usuario `ADMIN`** en la misma transacción.

## 6. Arquitectura del backend

Capas estrictas, con una responsabilidad por capa:

```
routes/ -> controllers/ -> services/ -> repositories/ -> Prisma -> MySQL
```

| Capa | Responsabilidad |
|---|---|
| `routes` | Endpoints y middlewares (auth, rate limit, validación) |
| `controllers` | Traducir HTTP a dominio. Sin lógica de negocio |
| `services` | Reglas: comisiones, descuentos, totales, metas |
| `repositories` | Único acceso a la base de datos. Exige siempre `emprendimientoId` |

La API se documenta con OpenAPI/Swagger generado desde los esquemas Zod.

## 7. Sincronización

1. La venta se guarda en IndexedDB con su `uuid` y estado `pendiente`.
2. La pantalla se limpia de inmediato; nunca hay espera.
3. Una cola envía en segundo plano y reintenta con espera creciente.
4. Al confirmar el servidor, la venta pasa a `sincronizada`.
5. El servidor ignora `uuid` repetidos y responde éxito igual, para que un reintento tras
   una respuesta perdida no duplique nada.

Los totales mostrados son **del evento completo**: último total conocido del servidor más
las ventas locales de este dispositivo, con un aviso visible del tipo *"N ventas sin
sincronizar"* para que nadie interprete un número incompleto como definitivo.

## 8. Pantallas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/login`, `/registro` | Entrar / crear emprendimiento | Público |
| `/eventos` | Eventos activos; elegir en cuál se trabaja | Todos |
| `/eventos/:id/vender` | Calculadora de venta | Todos |
| `/eventos/:id/panel` | Meta y totales por método | Todos |
| `/eventos/:id/panel` (bloque neto) | Comisiones y neto real | Solo admin |
| `/eventos/:id/lineas` | Tabla de líneas + candado | Admin |
| `/catalogo` | Categorías y productos maestros | Admin |
| `/configuracion` | Métodos de pago, comisiones, preajuste Bold | Admin |

Jerarquía semántica `h1` (pantalla) → `h2` (bloque) → `h3` (subbloque). Sin sourcemaps en
producción (`build.sourcemap: false`).

### Flujo de venta

1. Tocar cantidades en las líneas del evento; subtotales en vivo.
2. Activar los descuentos que apliquen.
3. Elegir método de pago.
4. Si es efectivo, el botón **"Pago exacto"** llena el monto recibido con el total de un
   toque; si no, se escribe lo recibido y se muestra el cambio.
5. Registrar: se guarda local y entra a la cola.

El panel muestra la barra de progreso hacia la meta (configurable por evento, por defecto
$1.000.000, medida sobre ventas brutas) y tarjetas con el acumulado por método de pago;
ambas visibles para todos. El total entregado en descuentos, las comisiones y el neto tras
comisiones se muestran solo al administrador.

## 9. Seguridad

- Contraseñas con **argon2**; JWT de acceso corto y refresh token rotativo.
- **Rate limit** por IP y por usuario, más estricto en el login.
- Validación de toda entrada con **Zod** antes de llegar al servicio.
- `helmet`, CORS restringido al dominio de Vercel, sin sourcemaps en producción.
- Aislamiento entre emprendimientos en la capa de repositorios, respaldado por pruebas.

## 10. Manejo de errores

| Situación | Comportamiento |
|---|---|
| Sin señal | La venta queda en cola. No se trata como error |
| Token vencido | Se renueva y reintenta; no expulsa al vendedor a mitad de feria |
| Venta rechazada por el servidor | Se marca visiblemente y nunca se borra |
| Evento cerrado o catálogo bloqueado | El servidor rechaza con motivo legible en español |
| Reloj del dispositivo desfasado | Se guardan ambas horas: dispositivo y servidor |
| Navegador sin almacenamiento (incógnito) | Se avisa antes de vender, no después |

## 11. Pruebas

- **Unitarias** de servicios: comisiones, descuentos y redondeo a peso entero.
- **Aislamiento entre emprendimientos:** leer datos ajenos debe fallar. Sustituye al RLS.
- **Idempotencia:** enviar la misma venta dos veces deja un solo registro.
- **Offline de punta a punta:** cortar red, vender, restaurar red, verificar que todo llegó
  una sola vez.
- **Rate limit:** el login se bloquea tras varios intentos fallidos.

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Fuga de datos entre emprendimientos por un bug (no hay RLS) | Capa única de repositorios + pruebas de fuga obligatorias |
| Ventas duplicadas por reintentos | `uuid` de idempotencia generado en el dispositivo |
| Pérdida de datos si se pierde el celular antes de sincronizar | Sincronización oportunista y aviso permanente de pendientes |
| Confusión del vendedor con cifras de comisión | Separación por rol: el vendedor solo ve el total a cobrar |
