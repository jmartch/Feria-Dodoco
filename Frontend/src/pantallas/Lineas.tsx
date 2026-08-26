import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import { formatearPesos } from "../dinero/formato";
import type { Evento, EventoItem } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Lineas() {
  const { id: eventoId = "" } = useParams();
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiEventos(cliente), [cliente]);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [lineas, setLineas] = useState<EventoItem[]>([]);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState(0);

  async function recargar() {
    setEvento(await api.buscar(eventoId));
    setLineas(await api.listarLineas(eventoId));
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, eventoId]);

  if (!evento) return <Cargando que="las líneas" />;
  const bloqueado = evento.catalogoBloqueado;

  async function agregar() {
    if (bloqueado || !nombre || precio <= 0) return;
    await api.crearLinea(eventoId, { nombre, precio });
    setNombre("");
    setPrecio(0);
    await recargar();
  }

  async function alternarCandado() {
    await api.cambiarCandado(eventoId, !bloqueado);
    await recargar();
  }

  return (
    <section>
      <h1>Líneas del evento</h1>
      <button type="button" onClick={alternarCandado}>
        {bloqueado ? "Quitar candado" : "Poner candado"}
      </button>

      <h2>Líneas</h2>
      <ul>
        {lineas.map((l) => (
          <li key={l.id}>
            {l.nombre} — {formatearPesos(l.precio)}
            {!bloqueado && (
              <button type="button" onClick={async () => { await api.eliminarLinea(eventoId, l.id); await recargar(); }}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2>Añadir línea manual</h2>
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={bloqueado} /></label>
      <label>Precio<input type="number" min={0} step={1} value={precio || ""} onChange={(e) => setPrecio(Math.max(0, Math.trunc(Number(e.target.value))))} disabled={bloqueado} /></label>
      <button type="button" onClick={agregar} disabled={bloqueado}>Añadir línea</button>
    </section>
  );
}
