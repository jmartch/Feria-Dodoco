import { createApp } from "./app.js";

const puerto = Number(process.env.PORT ?? 3000);

createApp().listen(puerto, () => {
  console.log(`API escuchando en el puerto ${puerto}`);
});
