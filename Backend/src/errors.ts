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
