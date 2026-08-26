import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { crearApiUsuarios } from "../api/usuarios";
import { ErrorApi, type Usuario } from "../api/tipos";
import { Aviso } from "./Aviso";

export function Empleados() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiUsuarios(cliente), [cliente]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function recargar() {
    setUsuarios(await api.listar());
  }

  useEffect(() => {
    api.listar().then(setUsuarios).catch(() => {});
  }, [api]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !email || password.length < 8) return;
    setError(null);
    setGuardando(true);
    try {
      await api.crear({ nombre, email, password });
      setNombre("");
      setEmail("");
      setPassword("");
      await recargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo crear el vendedor.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    setError(null);
    try {
      await api.eliminar(id);
      await recargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <>
      <h2>Equipo</h2>
      <ul>
        {usuarios.map((u) => (
          <li key={u.id}>
            <div className="sel-info">
              <div className="sel-nombre">{u.nombre}</div>
              <div className="sel-precio">{u.email} · {u.rol === "ADMIN" ? "Administrador" : "Vendedor"}</div>
            </div>
            {u.rol !== "ADMIN" && (
              <button type="button" onClick={() => eliminar(u.id)}>Quitar</button>
            )}
          </li>
        ))}
      </ul>

      <h2>Agregar vendedor</h2>
      <form onSubmit={agregar} className="form-evento">
        {error && <Aviso mensaje={error} />}
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </label>
        <button type="submit" className="principal" disabled={guardando}>Crear vendedor</button>
      </form>
      <p className="nota">El vendedor entra con ese correo y contraseña, y solo ve la venta y el panel — no la configuración ni los gastos.</p>
    </>
  );
}
