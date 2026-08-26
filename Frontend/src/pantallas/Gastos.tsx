import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiGastos } from "../api/gastos";
import { crearApiVentas } from "../api/ventas";
import { formatearPesos } from "../dinero/formato";
import type { Gasto, TotalesEvento } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";
import { Aviso } from "../componentes/Aviso";

const CATEGORIAS = ["Materiales", "Transporte", "Comida", "Puesto/Stand", "Publicidad", "Otro"];

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export function Gastos() {
  const { id: eventoId = "" } = useParams();
  const { cliente } = useAuth();
  const apiGastos = useMemo(() => crearApiGastos(cliente), [cliente]);
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);

  const [gastos, setGastos] = useState<Gasto[] | null>(null);
  const [totalGastos, setTotalGastos] = useState(0);
  const [totales, setTotales] = useState<TotalesEvento | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [monto, setMonto] = useState(0);
  const [guardando, setGuardando] = useState(false);

  async function recargar() {
    const r = await apiGastos.listar(eventoId);
    setGastos(r.gastos);
    setTotalGastos(r.total);
  }

  useEffect(() => {
    recargar().catch(() => setGastos([]));
    apiVentas.totales(eventoId).then(setTotales).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiGastos, apiVentas, eventoId]);

  if (!gastos) return <Cargando que="los gastos" />;

  const neto = totales?.neto ?? totales?.bruto ?? 0;
  const ganancia = neto - totalGastos;

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!concepto || monto <= 0) return;
    setError(null);
    setGuardando(true);
    try {
      await apiGastos.crear(eventoId, { concepto, categoria, monto });
      setConcepto("");
      setMonto(0);
      await recargar();
    } catch {
      setError("No se pudo guardar el gasto.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    await apiGastos.eliminar(eventoId, id);
    await recargar();
  }

  return (
    <section>
      <h1>Gastos y ganancia</h1>

      <h2>Resultado de la feria</h2>
      <div className="stats">
        <div className="stat">
          <span className="stat-valor">{formatearPesos(totales?.bruto ?? 0)}</span>
          <span className="stat-etq">Vendido</span>
        </div>
        <div className="stat">
          <span className="stat-valor">{formatearPesos(totalGastos)}</span>
          <span className="stat-etq">Gastos</span>
        </div>
        <div className="stat destacado">
          <span className="stat-valor">{formatearPesos(ganancia)}</span>
          <span className="stat-etq">Ganancia</span>
        </div>
        <div className="stat">
          <span className="stat-valor">{formatearPesos(neto)}</span>
          <span className="stat-etq">Neto tras comisiones</span>
        </div>
      </div>
      <p className="nota">La ganancia es lo neto (después de comisiones) menos los gastos.</p>

      <h2>Agregar gasto</h2>
      <form onSubmit={agregar} className="form-evento">
        {error && <Aviso mensaje={error} />}
        <label>
          En qué gastaste
          <input value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
        </label>
        <label>
          Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Monto (pesos)
          <input
            type="number"
            min={0}
            step={100}
            value={monto || ""}
            onChange={(e) => setMonto(Math.max(0, Math.trunc(Number(e.target.value))))}
          />
        </label>
        <button type="submit" className="principal" disabled={guardando}>Agregar gasto</button>
      </form>

      <h2>Gastos registrados</h2>
      {gastos.length === 0 ? (
        <p className="vacio">Aún no hay gastos.</p>
      ) : (
        <ul>
          {gastos.map((g) => (
            <li key={g.id}>
              <div className="sel-info">
                <div className="sel-nombre">{g.concepto}</div>
                <div className="sel-precio">{g.categoria} · {fecha(g.creadoEn)}</div>
              </div>
              <strong className="gasto-monto">{formatearPesos(g.monto)}</strong>
              <button type="button" onClick={() => eliminar(g.id)}>Borrar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
