import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import { crearApiVentas } from "../api/ventas";
import { crearApiCatalogo } from "../api/catalogo";
import { crearCola } from "../sync/cola";
import { calcularVenta } from "../dinero/calculo";
import { formatearPesos } from "../dinero/formato";
import { ventasACSV, descargarCSV, nombreArchivoCSV } from "../dinero/csv";
import { mensajeDelDia } from "../dinero/mensaje";
import type { Descuento, MetodoPago, TotalesEvento, VentaGuardada } from "../api/tipos";
import { BarraMeta } from "../componentes/BarraMeta";
import { Cargando } from "../componentes/Cargando";

// Producto vendible: sale directo del catálogo del emprendimiento.
type Producto = { id: string; nombre: string; precio: number; icono: string | null };

// El método en efectivo es el único que pide "recibido" y calcula cambio.
const esEfectivoNombre = (nombre: string) => /efectivo/i.test(nombre);

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

export function Vender() {
  const { id: eventoId = "" } = useParams();
  const { cliente, usuario } = useAuth();
  const apiEventos = useMemo(() => crearApiEventos(cliente), [cliente]);
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);
  const apiCatalogo = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const cola = useMemo(() => crearCola(apiVentas), [apiVentas]);
  const esAdmin = usuario?.rol === "ADMIN";

  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [totales, setTotales] = useState<TotalesEvento | null>(null);
  const [ventas, setVentas] = useState<VentaGuardada[]>([]);
  const [nombreFeria, setNombreFeria] = useState("");
  const [verResumen, setVerResumen] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [descuentoId, setDescuentoId] = useState<string | null>(null);
  const [metodoId, setMetodoId] = useState<string>("");
  const [recibido, setRecibido] = useState<number>(0);
  // Cuando no es null, el formulario corrige esa venta en vez de crear una nueva.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Líneas de una venta en edición cuyo producto ya no está en el catálogo
  // (renombrado o borrado). Se conservan como "producto retirado".
  const [lineasExtra, setLineasExtra] = useState<{ nombre: string; precioUnitario: number; cantidad: number }[]>([]);

  // Emoji del producto por nombre; si ya no existe en el catálogo, uno neutro.
  const iconoDe = useCallback(
    (nombre: string) => (productos ?? []).find((p) => p.nombre === nombre)?.icono ?? "🛍️",
    [productos],
  );

  const metodoPorDefecto = useCallback((lista: MetodoPago[]) => {
    const efectivo = lista.find((m) => esEfectivoNombre(m.nombre));
    return efectivo?.id ?? lista[0]?.id ?? "";
  }, []);

  const refrescarResumen = useCallback(() => {
    apiVentas.totales(eventoId).then(setTotales).catch(() => {});
    apiVentas.listar(eventoId).then(setVentas).catch(() => {});
  }, [apiVentas, eventoId]);

  useEffect(() => {
    Promise.all([
      apiCatalogo.listarCategorias(),
      apiEventos.listarDescuentos(eventoId),
      apiCatalogo.listarMetodos(),
    ]).then(([cats, ds, ms]) => {
      setProductos(cats.map((c) => ({ id: c.id, nombre: c.nombre, precio: c.precio, icono: c.icono ?? null })));
      setDescuentos(ds.filter((d) => d.activo));
      const activos = ms.filter((m) => m.activo);
      setMetodos(activos);
      setMetodoId(metodoPorDefecto(activos));
    });
    apiEventos.buscar(eventoId).then((e) => setNombreFeria(e.nombre)).catch(() => {});
    refrescarResumen();
  }, [apiCatalogo, apiEventos, eventoId, refrescarResumen, metodoPorDefecto]);

  const descuentoActivo = descuentos.find((d) => d.id === descuentoId) ?? null;
  const metodoActivo = metodos.find((m) => m.id === metodoId) ?? null;
  const esEfectivo = metodoActivo ? esEfectivoNombre(metodoActivo.nombre) : true;

  const calculo = useMemo(() => {
    const items = (productos ?? []).map((p) => ({
      nombre: p.nombre,
      precioUnitario: p.precio,
      cantidad: cantidades[p.id] ?? 0,
    }));
    // Las líneas de producto retirado (solo al editar) entran igual en el cálculo.
    const extras = lineasExtra.filter((l) => l.cantidad > 0);
    return calcularVenta({
      lineas: [...items, ...extras],
      descuentoPct: descuentoActivo?.porcentaje ?? 0,
      comisionPct: metodoActivo?.comisionPct ?? 0,
      recibido,
    });
  }, [productos, cantidades, lineasExtra, descuentoActivo, metodoActivo, recibido]);

  // Desglose del día por producto: cuántas unidades y cuánto sumó cada uno.
  const porProducto = useMemo(() => {
    const acc = new Map<string, { cantidad: number; total: number }>();
    for (const v of ventas) {
      for (const it of v.items ?? []) {
        const a = acc.get(it.nombre) ?? { cantidad: 0, total: 0 };
        a.cantidad += it.cantidad;
        a.total += it.subtotal;
        acc.set(it.nombre, a);
      }
    }
    return [...acc.entries()]
      .map(([nombre, x]) => ({ nombre, icono: iconoDe(nombre), ...x }))
      .sort((a, b) => b.total - a.total);
  }, [ventas, iconoDe]);

  function cambiarCantidad(productoId: string, delta: number) {
    setCantidades((prev) => ({ ...prev, [productoId]: Math.max(0, (prev[productoId] ?? 0) + delta) }));
  }

  function mostrarAviso(texto: string) {
    setAviso(texto);
    window.setTimeout(() => setAviso(null), 2500);
  }

  function limpiarFormulario() {
    setCantidades({});
    setLineasExtra([]);
    setRecibido(0);
    setDescuentoId(null);
    setEditandoId(null);
    setMetodoId(metodoPorDefecto(metodos));
  }

  function cambiarExtra(indice: number, delta: number) {
    setLineasExtra((prev) =>
      prev.map((l, i) => (i === indice ? { ...l, cantidad: Math.max(0, l.cantidad + delta) } : l)),
    );
  }

  async function registrar() {
    if (calculo.total <= 0 || !metodoActivo) return;
    // Sin efectivo no hay vueltas: se registra "recibido = total" para que el cambio sea 0.
    const recibidoFinal = esEfectivo ? recibido : calculo.total;
    const lineas = calculo.items.map((i) => ({ nombre: i.nombre, precioUnitario: i.precioUnitario, cantidad: i.cantidad }));

    if (editandoId) {
      // Corrección de una venta ya registrada: va directo al servidor.
      try {
        await apiVentas.actualizar(eventoId, editandoId, {
          lineas,
          metodoPagoId: metodoActivo.id,
          descuentoId: descuentoActivo?.id ?? null,
          recibido: recibidoFinal,
        });
        limpiarFormulario();
        mostrarAviso("✅ Venta actualizada");
        refrescarResumen();
      } catch {
        mostrarAviso("⚠️ No se pudo actualizar la venta");
      }
      return;
    }

    const cuerpo = {
      uuid: crypto.randomUUID(),
      lineas,
      metodoPagoId: metodoActivo.id,
      descuentoId: descuentoActivo?.id ?? null,
      recibido: recibidoFinal,
      // La hora de la venta queda registrada aquí, en el momento exacto del cobro.
      creadaEnDispositivo: new Date().toISOString(),
    };
    // Local-first: se guarda y se limpia sin esperar a la red. La cola envía sola.
    await cola.encolar(eventoId, cuerpo);
    limpiarFormulario();
    // Confirmación visible para evitar registros duplicados por falta de respuesta.
    mostrarAviso("✅ Venta registrada correctamente");
    await cola.sincronizar();
    refrescarResumen();
  }

  function editarVenta(v: VentaGuardada) {
    // Se reconstruyen las cantidades emparejando cada item con su producto por
    // nombre. Los que ya no están en el catálogo se conservan como "producto retirado".
    const nuevas: Record<string, number> = {};
    const retirados: { nombre: string; precioUnitario: number; cantidad: number }[] = [];
    for (const it of v.items ?? []) {
      const prod = (productos ?? []).find((p) => p.nombre === it.nombre);
      if (prod) nuevas[prod.id] = (nuevas[prod.id] ?? 0) + it.cantidad;
      else retirados.push({ nombre: it.nombre, precioUnitario: it.precioUnitario, cantidad: it.cantidad });
    }
    setCantidades(nuevas);
    setLineasExtra(retirados);
    setMetodoId(metodos.find((m) => m.nombre === v.metodoPagoNombre)?.id ?? metodoPorDefecto(metodos));
    setDescuentoId(descuentos.find((d) => d.nombre === v.descuentoNombre)?.id ?? null);
    setRecibido(v.recibido ?? 0);
    setEditandoId(v.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function borrarVenta(id: string) {
    if (!window.confirm("¿Eliminar esta venta? No se puede deshacer.")) return;
    try {
      await apiVentas.eliminar(eventoId, id);
    } catch {
      // Si aún estaba en la cola (sin id de servidor) no pasa nada; se refresca igual.
    }
    if (editandoId === id) limpiarFormulario();
    refrescarResumen();
  }

  function exportar() {
    const archivo = nombreArchivoCSV(usuario?.nombreEmprendimiento ?? "tienda", nombreFeria || "feria");
    descargarCSV(archivo, ventasACSV(ventas));
  }

  async function compartir() {
    if (ventas.length === 0) return;
    const texto = mensajeDelDia(nombreFeria || "la feria", ventas);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Resumen de ventas", text: texto });
      } else {
        // Sin compartir nativo (escritorio): se abre WhatsApp con el texto listo.
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
      }
    } catch {
      // El usuario canceló el diálogo de compartir; no es un error.
    }
  }

  if (!productos) return <Cargando que="la venta" />;

  // La venta recién registrada arriba: retroalimentación inmediata.
  const ventasRecientes = [...ventas].reverse();

  return (
    <section>
      <h1>Vender</h1>

      {aviso && (
        <div className="toast-ok" role="status" aria-live="polite">
          {aviso}
        </div>
      )}

      <div className="resumen-dia">
        <BarraMeta bruto={totales?.bruto ?? 0} meta={totales?.meta ?? 0} />
        <div className="resumen-acciones">
          <button type="button" onClick={() => setVerResumen((v) => !v)}>
            {verResumen ? "Ocultar resumen" : "Ver resumen"}
          </button>
          <button type="button" onClick={compartir} disabled={ventas.length === 0}>
            Compartir ventas
          </button>
          <button type="button" onClick={exportar} disabled={ventas.length === 0}>
            Exportar CSV
          </button>
        </div>
        {verResumen && totales && (
          <div className="resumen-detalle">
            <div className="metodo-fila"><span>Ventas</span><strong>{totales.cantidadVentas}</strong></div>

            <div className="resumen-titulo">Por producto</div>
            {porProducto.length === 0 ? (
              <div className="metodo-fila"><span>Aún no hay productos vendidos</span></div>
            ) : (
              porProducto.map((p) => (
                <div className="metodo-fila" key={p.nombre}>
                  <span><span className="mf-emoji">{p.icono}</span> {p.cantidad}× {p.nombre}</span>
                  <strong>{formatearPesos(p.total)}</strong>
                </div>
              ))
            )}

            <div className="resumen-titulo">Por método</div>
            {totales.porMetodo.map((m) => (
              <div className="metodo-fila" key={m.metodo}>
                <span>{m.metodo}</span>
                <strong>{formatearPesos(m.total)}</strong>
              </div>
            ))}

            {esAdmin && (
              <Link to={`/eventos/${eventoId}/gastos`} className="evento-chip">Gastos y ganancia →</Link>
            )}
          </div>
        )}
      </div>

      <h2>Productos</h2>
      {productos.length === 0 ? (
        <p className="venta-vacia">Aún no tienes productos. Agrégalos en “Catálogo”.</p>
      ) : (
        <ul className="venta-lista">
          {productos.map((producto) => {
            const cantidad = cantidades[producto.id] ?? 0;
            return (
              <li key={producto.id} aria-label={producto.nombre} className={`sel-fila${cantidad > 0 ? " activo" : ""}`}>
                <div className="prod-emoji">{producto.icono ?? "🛍️"}</div>
                <div className="sel-info">
                  <div className="sel-nombre">{producto.nombre}</div>
                  <div className="sel-precio">{formatearPesos(producto.precio)}</div>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => cambiarCantidad(producto.id, -1)}>−</button>
                  <span className="cant">{cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(producto.id, 1)}>+</button>
                </div>
                <span className="sel-subtotal">{formatearPesos(producto.precio * cantidad)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {lineasExtra.length > 0 && (
        <ul className="venta-lista">
          {lineasExtra.map((l, i) => (
            <li key={`extra-${i}`} className={`sel-fila retirado${l.cantidad > 0 ? " activo" : ""}`}>
              <div className="prod-emoji">🚫</div>
              <div className="sel-info">
                <div className="sel-nombre">{l.nombre}</div>
                <div className="sel-precio">Producto retirado · {formatearPesos(l.precioUnitario)}</div>
              </div>
              <div className="stepper">
                <button type="button" onClick={() => cambiarExtra(i, -1)}>−</button>
                <span className="cant">{l.cantidad}</span>
                <button type="button" onClick={() => cambiarExtra(i, 1)}>+</button>
              </div>
              <span className="sel-subtotal">{formatearPesos(l.precioUnitario * l.cantidad)}</span>
            </li>
          ))}
        </ul>
      )}

      {descuentos.length > 0 && (
        <>
          <h2>Descuentos</h2>
          <div className="chips">
            {descuentos.map((d) => (
              <label key={d.id}>
                <input
                  type="radio"
                  name="descuento"
                  checked={descuentoId === d.id}
                  onChange={() => setDescuentoId(descuentoId === d.id ? null : d.id)}
                />
                {d.nombre}
              </label>
            ))}
          </div>
        </>
      )}

      <h2>Método de pago</h2>
      <div className="chips">
        {metodos.map((m) => (
          <label key={m.id}>
            <input type="radio" name="metodo" checked={metodoId === m.id} onChange={() => setMetodoId(m.id)} />
            {m.nombre}
          </label>
        ))}
      </div>

      <div className="cobro">
        {editandoId && (
          <div className="cobro-editando">
            <span>Editando una venta</span>
            <button type="button" onClick={limpiarFormulario}>Cancelar</button>
          </div>
        )}
        {esEfectivo && (
          <div className="cobro-efectivo">
            <div className="cobro-pago">
              <label>
                Recibido
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={recibido || ""}
                  onChange={(e) => setRecibido(Math.max(0, Math.trunc(Number(e.target.value))))}
                />
              </label>
              <button type="button" onClick={() => setRecibido(calculo.total)}>Pago exacto</button>
            </div>
            <div className="cobro-cambio">
              <span>Cambio</span>
              <strong>{formatearPesos(calculo.cambio)}</strong>
            </div>
          </div>
        )}
        {/* Total y botón en una sola fila: compacto y siempre a la mano al fondo. */}
        <div className="cobro-cta">
          <div className="cobro-total">
            <span>Total a cobrar</span>
            <strong>{formatearPesos(calculo.total)}</strong>
          </div>
          <button type="button" className="principal" onClick={registrar} disabled={calculo.total <= 0}>
            {editandoId ? "Guardar cambios" : "Registrar venta"}
          </button>
        </div>
      </div>

      <h2>Ventas de hoy</h2>
      {ventasRecientes.length === 0 ? (
        <p className="venta-vacia">Aún no hay ventas registradas.</p>
      ) : (
        <ul className="ventas-hechas">
          {ventasRecientes.map((v) => {
            const items = v.items ?? [];
            const texto = items.map((it) => `${it.cantidad}× ${it.nombre}`).join(", ");
            return (
              <li key={v.id || v.uuid} className={`venta-hecha${editandoId === v.id ? " editando" : ""}`}>
                <div className="vh-emojis">
                  {items.map((it, i) => (
                    <span key={i}>{iconoDe(it.nombre)}</span>
                  ))}
                </div>
                <div className="vh-info">
                  <span className="vh-productos">{texto || "Venta"}</span>
                  <span className="vh-meta">
                    {v.metodoPagoNombre} · {hora(v.creadaEnDispositivo)}
                    {esAdmin && v.neto != null ? ` · neto ${formatearPesos(v.neto)}` : ""}
                  </span>
                </div>
                <strong className="vh-total">{formatearPesos(v.total)}</strong>
                <div className="vh-acciones">
                  <button type="button" className="vh-editar" onClick={() => editarVenta(v)} aria-label="Editar venta">
                    Editar
                  </button>
                  <button type="button" className="vh-borrar" onClick={() => borrarVenta(v.id)} aria-label="Eliminar venta">
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
