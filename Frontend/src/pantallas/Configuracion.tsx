import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { crearApiCatalogo } from "../api/catalogo";
import type { MetodoPago } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Configuracion() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const [metodos, setMetodos] = useState<MetodoPago[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState(0); // en % (1,5), se convierte a puntos básicos

  async function recargar() {
    setMetodos(await api.listarMetodos());
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  if (!metodos) return <Cargando que="la configuración" />;

  async function agregar() {
    if (!nombre) return;
    // El backend guarda la comisión en puntos básicos enteros: 1,5 % -> 150.
    const comisionPct = Math.round(porcentaje * 100);
    await api.crearMetodo({ nombre, comisionPct, activo: true });
    setNombre("");
    setPorcentaje(0);
    await recargar();
  }

  async function aplicarBold() {
    await api.preajusteBold();
    await recargar();
  }

  return (
    <section>
      <h1>Configuración</h1>

      <h2>Métodos de pago</h2>
      <ul>
        {metodos.map((m) => (
          <li key={m.id}>{m.nombre}</li>
        ))}
      </ul>

      <button type="button" onClick={aplicarBold}>Aplicar preajuste de Bold</button>

      <h2>Agregar método</h2>
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Comisión (%)<input type="number" min={0} step={0.1} value={porcentaje || ""} onChange={(e) => setPorcentaje(Math.max(0, Number(e.target.value)))} /></label>
      <button type="button" onClick={agregar}>Agregar método</button>
    </section>
  );
}
