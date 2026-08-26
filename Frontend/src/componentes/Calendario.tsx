import { useMemo, useState } from "react";
import type { Evento } from "../api/tipos";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

/** Marca cada día que tiene al menos un evento que empieza ese día. */
export function Calendario({ eventos }: { eventos: Evento[] }) {
  // El calendario abre en el mes del próximo evento futuro; si no hay, en el mes actual.
  const [ancla, setAncla] = useState<Date>(() => {
    const hoy = new Date();
    const futuros = eventos
      .map((e) => new Date(e.fechaInicio))
      .filter((d) => d >= new Date(hoy.getFullYear(), hoy.getMonth(), 1))
      .sort((a, b) => a.getTime() - b.getTime());
    const base = futuros[0] ?? hoy;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const anio = ancla.getFullYear();
  const mes = ancla.getMonth();

  const porDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    for (const evento of eventos) {
      const d = new Date(evento.fechaInicio);
      const clave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const lista = mapa.get(clave) ?? [];
      lista.push(evento);
      mapa.set(clave, lista);
    }
    return mapa;
  }, [eventos]);

  const primero = new Date(anio, mes, 1);
  // getDay(): 0=domingo … 6=sábado. La semana empieza en lunes, así que se corre.
  const offset = (primero.getDay() + 6) % 7;
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();

  const celdas: (number | null)[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasDelMes; d++) celdas.push(d);

  return (
    <div className="cal">
      <div className="cal-cabecera">
        <button type="button" onClick={() => setAncla(new Date(anio, mes - 1, 1))} aria-label="Mes anterior">
          ‹
        </button>
        <strong>{MESES[mes]} {anio}</strong>
        <button type="button" onClick={() => setAncla(new Date(anio, mes + 1, 1))} aria-label="Mes siguiente">
          ›
        </button>
      </div>
      <div className="cal-rejilla">
        {DIAS.map((d) => (
          <span key={d} className="cal-nombre-dia">{d}</span>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <span key={`v${i}`} className="cal-celda vacia" />;
          const clave = `${anio}-${mes}-${d}`;
          const delDia = porDia.get(clave) ?? [];
          const conEvento = delDia.length > 0;
          return (
            <span
              key={clave}
              className={`cal-celda${conEvento ? " con-evento" : ""}`}
              title={conEvento ? delDia.map((e) => e.nombre).join(", ") : undefined}
            >
              {d}
              {conEvento && <span className="cal-punto" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}
