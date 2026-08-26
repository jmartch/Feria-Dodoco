import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiVentas } from "../api/ventas";
import { crearCola } from "../sync/cola";
import { formatearPesos } from "../dinero/formato";
import type { TotalesEvento } from "../api/tipos";
import { BarraMeta } from "../componentes/BarraMeta";
import { Cargando } from "../componentes/Cargando";

export function Panel() {
  const { id: eventoId = "" } = useParams();
  const { cliente, usuario } = useAuth();
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);
  const cola = useMemo(() => crearCola(apiVentas), [apiVentas]);
  const [totales, setTotales] = useState<TotalesEvento | null>(null);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    apiVentas.totales(eventoId).then(setTotales).catch(() => setTotales(null));
    cola.contarPendientes().then(setPendientes);
  }, [apiVentas, cola, eventoId]);

  if (!totales) return <Cargando que="el panel" />;

  const esAdmin = usuario?.rol === "ADMIN";

  return (
    <section>
      <h1>Panel</h1>

      <h2>Meta</h2>
      <BarraMeta bruto={totales.bruto} meta={totales.meta} />
      {pendientes > 0 && <p role="status">{pendientes} ventas sin sincronizar</p>}

      <h2>Por método de pago</h2>
      <ul>
        {totales.porMetodo.map((m) => (
          <li key={m.metodo}>
            {m.metodo}: {formatearPesos(m.total)}
          </li>
        ))}
      </ul>

      {esAdmin && totales.comisiones !== undefined && totales.neto !== undefined && (
        <>
          <h2>Solo administración</h2>
          <p>Comisiones: {formatearPesos(totales.comisiones)}</p>
          <p>Neto tras comisiones: {formatearPesos(totales.neto)}</p>
        </>
      )}
    </section>
  );
}
