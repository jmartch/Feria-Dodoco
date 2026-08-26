import { setupServer } from "msw/node";

// Arranca sin handlers: cada prueba registra los suyos con servidorMock.use(...).
export const servidorMock = setupServer();
