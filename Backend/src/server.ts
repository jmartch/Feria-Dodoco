// Debe ir primero: los servicios leen sus secretos al ser evaluados.
import "dotenv/config";
import { createApp } from "./app.js";

const puerto = Number(process.env.PORT ?? 3000);

createApp().listen(puerto, () => {
  console.log(`API escuchando en el puerto ${puerto}`);
});
