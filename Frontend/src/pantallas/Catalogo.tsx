import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { crearApiCatalogo } from "../api/catalogo";
import { formatearPesos } from "../dinero/formato";
import type { Categoria } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Catalogo() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState(0);

  async function recargar() {
    setCategorias(await api.listarCategorias());
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  if (!categorias) return <Cargando que="el catálogo" />;

  async function agregar() {
    if (!nombre || precio <= 0) return;
    await api.crearCategoria({ nombre, precio });
    setNombre("");
    setPrecio(0);
    await recargar();
  }

  return (
    <section>
      <h1>Catálogo</h1>

      <h2>Categorías</h2>
      <ul>
        {categorias.map((c) => (
          <li key={c.id}>
            {c.nombre} — {formatearPesos(c.precio)}
            <button type="button" onClick={async () => { await api.eliminarCategoria(c.id); await recargar(); }}>Borrar</button>
          </li>
        ))}
      </ul>

      <h2>Agregar categoría</h2>
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Precio<input type="number" min={0} step={1} value={precio || ""} onChange={(e) => setPrecio(Math.max(0, Math.trunc(Number(e.target.value))))} /></label>
      <button type="button" onClick={agregar}>Agregar categoría</button>
    </section>
  );
}
