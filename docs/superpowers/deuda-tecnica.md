# Deuda técnica y acciones pendientes

Notas que sobreviven al proceso de implementación del Plan 1. Cada entrada dice qué
está mal, por qué se dejó así, y cuándo hay que resolverlo.

## Obligatorio antes de cerrar la Fase 2

### 1. Falta la prueba de fuga entre emprendimientos a nivel HTTP

**Qué pasa:** las pruebas demuestran que la *capa de repositorios* filtra por
emprendimiento (`Backend/test/aislamiento.test.ts`, la prueba "no deja leer un usuario de
otro emprendimiento aunque se sepa su id"). Lo que **ninguna prueba demuestra** es que la
capa HTTP le pase el scope correcto.

**Por qué no se pudo cubrir en el Plan 1:** el único endpoint autenticado es `GET
/auth/yo`, que consulta por `id`. Como `id` es clave primaria única, añadir el filtro por
`emprendimientoId` no puede cambiar el resultado: revertir el controlador a una consulta
sin scope daría exactamente la misma respuesta y la prueba seguiría en verde. Es
estructuralmente imposible cubrir el hueco con ese endpoint.

**Qué hacer:** al añadir el primer endpoint donde el scope sí puede divergir —cualquiera
que busque o liste por un identificador que no sea el del propio usuario autenticado—
escribir ahí la prueba: dos emprendimientos, el token de A pidiendo un recurso de B, y
esperar 404 o 403. Sin ella, un endpoint de negocio que olvide el scope pasaría
inadvertido, y no hay RLS que lo atrape.

### 2. Decisión pendiente: revocación de familia al reutilizar un refresh token

**Qué pasa:** cuando llega un refresh token ya consumido, se responde 401 y nada más.

**El escenario:** alguien roba un refresh token y lo usa antes que el dueño. Obtiene un par
nuevo, válido 30 días. El usuario legítimo recibe 401 en su siguiente refresh, vuelve a
entrar, y **la sesión del atacante sigue viva**. No hay logout ni forma de matarla.

Reutilizar un token ya rotado es precisamente la señal de que hubo robo: el diseño actual
la detecta y la descarta. Como `RefreshToken` ya guarda `usuarioId`, revocar todos los
tokens del usuario es un `updateMany`.

**Qué hacer:** decidir explícitamente si se implementa o se acepta el riesgo. No dejarlo
como omisión silenciosa.

### 3. `verificarAccessToken` castea el payload sin validarlo

`Backend/src/services/token.service.ts`. Hoy no hay defecto: el único emisor es
`firmarAccessToken`, así que la forma del payload está garantizada.

**El riesgo futuro:** ese cast es la raíz del modelo de aislamiento —
`req.auth.emprendimientoId` se cree porque el cast lo afirma. En el momento en que se firme
un **segundo tipo de token con el mismo secreto** (recuperar contraseña, invitar
vendedor), `autenticar` lo aceptaría y tomaría el scope de él.

**Qué hacer:** antes de emitir cualquier otro token, validar el payload con Zod o añadir un
claim `tipo: "access"` que `autenticar` exija.

## Puede esperar

- **`camposSeguros` duplicado.** `emprendimiento.repository.ts` repite la lista de campos
  seguros porque la constante de `usuario.repository.ts` no se exporta. La deriva solo
  puede omitir campos, nunca filtrar el hash. Exportarla cuando se toque el archivo.
- **Traducción de P2002 solo en un repositorio.** `usuarioRepository.crear` no traduce el
  choque de email único. Hoy no se llama desde ninguna ruta, pero cuando la Fase 2 añada
  "invitar vendedor", un email repetido dará 500 en vez de 409.
- **CORS de un solo origen.** `CORS_ORIGIN` no admite lista separada por comas, así que los
  *preview deployments* de Vercel (URL distinta por despliegue) quedan bloqueados. Además,
  si la variable falta, el fallo aparece en el navegador sin nada en los logs del servidor:
  un `console.warn` al arrancar ahorraría una tarde de diagnóstico.
- **Tabla `RefreshToken` sin poda.** Cada login añade una fila que vive 30 días y nunca se
  borra. Crece sin techo.
- **Sin apagado ordenado.** `server.ts` no maneja `SIGTERM` ni cierra Prisma; en cada
  redespliegue de Railway se cortan las peticiones en vuelo.
- **`"La sesión expiró"` también para tokens malformados.** Texto impreciso, sin fuga: el
  cliente hace lo mismo en ambos casos.
- **`agregarCategoriaComoLinea` trae todas las categorías para buscar una.** `evento.service.ts` usa `listarCategorias` + `find` en memoria en vez de una consulta puntual con scope. Con las decenas de categorías de una feria da igual; si un emprendimiento llega a cientos, conviene un `buscarCategoriaPorId(scope, id)` en el repositorio.
- **`aplicarPreajusteBold` comprueba y luego escribe sin candado.** `metodoPago.service.ts` hace `contar()` y después `crearVarios()`; dos peticiones simultáneas podrían pasar ambas la comprobación y dejar seis métodos. No hay índice único que lo impida. Solo lo alcanza un doble clic o un reintento, y se repara borrando los repetidos, pero un `@@unique([emprendimientoId, nombre])` lo cerraría.
- **`actualizarCategoria` no es transaccional.** `catalogo.repository.ts` hace `updateMany` y luego `findUniqueOrThrow`; si otro proceso borra la categoría entre ambas, lanza en vez de devolver `null`. Ventana mínima y sin fuga de datos, pero es un 500 evitable.
- **Indentación del `try/catch`** en `emprendimiento.repository.ts`: el cuerpo no quedó
  sangrado dentro del `try`. Cosmético, lo arreglará un formateador cuando se añada uno.

## Notas de mantenimiento

- **La prueba de `/docs.json` usa una lista cerrada de rutas.** Toda tarea que añada un
  endpoint al documento OpenAPI debe actualizar ese `toEqual` o la suite romperá.
- **`metaPorDefecto` es `Int`** (tope 2.147.483.647 COP). Correcto para una meta de feria,
  pero cuando la Fase 2 guarde acumulados, decidir `BigInt` **antes** de que haya datos:
  migrar una columna de dinero con filas dentro es caro.
- **Versiones fijadas a propósito:** Prisma `^6.19.3` (la 7 retira `url = env(...)` del
  esquema), Zod `^4`, `zod-openapi` `^5`. No subirlas sin una migración deliberada.
- **`npm audit`** reporta 3 vulnerabilidades altas en `prisma` → `@prisma/config` →
  `deepmerge-ts`. Prisma ahora es dependencia de producción porque `start:prod` ejecuta
  `migrate deploy`; la cadena solo se usa al migrar, no en el camino de las peticiones.
