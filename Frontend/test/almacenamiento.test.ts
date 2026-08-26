import { beforeEach, expect, it } from "vitest";
import { almacenamiento } from "../src/auth/almacenamiento";

beforeEach(() => localStorage.clear());

it("guarda, lee y borra el refresh token", () => {
  expect(almacenamiento.leerRefresh()).toBeNull();
  almacenamiento.guardarRefresh("ref-123");
  expect(almacenamiento.leerRefresh()).toBe("ref-123");
  almacenamiento.borrarRefresh();
  expect(almacenamiento.leerRefresh()).toBeNull();
});
