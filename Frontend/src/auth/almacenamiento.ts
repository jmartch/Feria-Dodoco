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
