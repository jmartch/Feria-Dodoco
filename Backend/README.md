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
| `JWT_ACCESS_SECRET` | Secreto del token de acceso. Sin él la API **no arranca**, a propósito |
| `JWT_REFRESH_SECRET` | Reservada: hoy el refresh se guarda hasheado y no se firma |
| `CORS_ORIGIN` | URL del frontend en Vercel |
| `PORT` | La inyecta Railway automáticamente; en local se usa 3000 |
