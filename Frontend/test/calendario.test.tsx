import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Calendario } from "../src/componentes/Calendario";
import type { Evento } from "../src/api/tipos";

function evento(id: string, nombre: string, fechaInicio: string): Evento {
  return { id, nombre, fechaInicio, fechaFin: null, meta: 1000000, catalogoBloqueado: false, estado: "ACTIVO" };
}

it("abre en el mes del próximo evento y marca su día", () => {
  // Fecha futura (para que sea el próximo evento) y a mediodía UTC, para que la
  // conversión a hora local no salte de día en ninguna zona horaria.
  render(<Calendario eventos={[evento("e1", "Feria de abril", "2099-04-15T12:00:00.000Z")]} />);

  // El calendario abre anclado al mes del evento; el <strong> parte el texto en
  // varios nodos, así que se compara el textContent completo.
  expect(
    screen.getByText((_, el) => el?.tagName === "STRONG" && el.textContent === "Abril 2099"),
  ).toBeInTheDocument();

  // El día del evento lleva la marca (título con el nombre) y la clase con-evento.
  const marcada = screen.getByTitle("Feria de abril");
  expect(marcada.className).toContain("con-evento");
  expect(marcada).toHaveTextContent("15");
});

it("sin eventos muestra el calendario pero no marca ningún día", () => {
  render(<Calendario eventos={[]} />);
  expect(screen.getByText("Lu")).toBeInTheDocument();
  expect(screen.queryByTitle(/./)).not.toBeInTheDocument();
});
