# Calculadora de precios · Dodoco Store

Calculadora web estática para calcular cuánto cobrar por productos de Dodoco Store.
Permite ingresar cantidades por producto, ver el subtotal en tiempo real, el total
general y aplicar opcionalmente un 10% de descuento por donación al acopio.

## 🧱 Estructura

```
/index.html   → estructura de la página
/style.css    → estilos (responsive, tema suave)
/script.js    → lógica de cálculo en tiempo real
/README.md    → este archivo
```

Sin frameworks ni dependencias. HTML, CSS y JavaScript vanilla.

## ▶️ Cómo probarlo localmente

Solo abre `index.html` en tu navegador (doble clic).
No requiere servidor ni instalación.

## 🚀 Cómo desplegarlo en Vercel

### Opción A — Desde la web (más fácil, sin instalar nada)

1. Sube esta carpeta a un repositorio de GitHub (o GitLab/Bitbucket).
2. Entra a [vercel.com](https://vercel.com) e inicia sesión.
3. Haz clic en **Add New… → Project**.
4. Importa el repositorio.
5. En la configuración deja todo por defecto:
   - **Framework Preset:** `Other`
   - **Build Command:** *(vacío)*
   - **Output Directory:** *(vacío)*
6. Haz clic en **Deploy**.
7. En unos segundos tendrás tu URL pública. ✨

### Opción B — Con la CLI de Vercel

1. Instala la CLI:
   ```bash
   npm i -g vercel
   ```
2. Desde esta carpeta, ejecuta:
   ```bash
   vercel
   ```
3. Sigue los pasos (acepta las opciones por defecto).
4. Para publicar en producción:
   ```bash
   vercel --prod
   ```

> No se necesita configuración extra: al ser un sitio estático, Vercel sirve
> `index.html` automáticamente.

## 🧮 Productos y precios

| Producto              | Precio     |
| --------------------- | ---------- |
| Pines                 | $12.000    |
| Llaveros de celular   | $16.000    |
| Diademas de Sanrio    | $15.000    |
| Stickers pequeños     | $5.000     |
| Stickers grandes      | $18.000    |

## ✅ Características

- Subtotal por producto en tiempo real.
- Total antes de descuento, descuento aplicado y total final.
- Descuento del 10% opcional (switch).
- **Método de pago:** Efectivo 💵 / QR 📱 / Datáfono 💳.
- **Monto recibido y cambio a devolver** (solo en efectivo; avisa si el pago es insuficiente).
- **Registro de ventas del día** guardado en el navegador (`localStorage`):
  - Botón **Registrar venta** (guarda productos, total, método, recibido y cambio).
  - Lista de ventas de hoy con hora, total, método y detalle.
  - **Total del día** acumulado (valor bruto, sin descontar comisiones).
  - Eliminar una venta individual o **vaciar las ventas de hoy**.
  - **Exportar CSV** (se abre en Excel) y **Copiar resumen** de texto.

### 💳 Comisiones por método de pago

El cliente **siempre paga el total completo**, sin importar el método. La comisión
del medio de pago reduce la ganancia real, y **eso solo se muestra en el Excel**
(no en la app, para no confundir al vendedor):

| Método    | Comisión |
| --------- | -------- |
| Efectivo  | 0%       |
| QR        | 1,5%     |
| Datáfono  | 5%       |

Al **Exportar CSV** se agregan las columnas: *Método*, *Comisión %*, *Comisión $*
y *Neto recibido* (total − comisión), con un resumen del día que incluye el
**total bruto**, el **total de comisiones** y el **neto** del día.
- Botón **Limpiar todo** (reinicia cantidades, descuento y pago; no borra ventas).
- Solo acepta números enteros mayores o iguales a 0.
- Precios formateados en pesos colombianos con `Intl.NumberFormat`.
- Diseño responsive para móvil y escritorio.

## 💾 Sobre las ventas guardadas

Las ventas se guardan en el **navegador y dispositivo** donde uses la app
(`localStorage`), no en un servidor. Esto significa:

- Si abres la app en otro celular o computador, no verás las mismas ventas.
- Si borras los datos del navegador, se pierden las ventas.
- Usa **Exportar CSV** al final del día para guardar un respaldo.

> Recomendación: usa siempre el mismo dispositivo/navegador para llevar la
> cuenta del día, y exporta el CSV antes de cerrar.
