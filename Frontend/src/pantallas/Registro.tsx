import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorApi } from "../api/tipos";
import { Aviso } from "../componentes/Aviso";

export function Registro() {
  const { registrar } = useAuth();
  const navegar = useNavigate();
  const [nombreEmprendimiento, setNombreEmprendimiento] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await registrar({ nombreEmprendimiento, nombreUsuario, email, password });
      navegar("/eventos");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <h1>Crear emprendimiento</h1>
      {error && <Aviso mensaje={error} />}
      <label>
        Nombre del emprendimiento
        <input value={nombreEmprendimiento} onChange={(e) => setNombreEmprendimiento(e.target.value)} required />
      </label>
      <label>
        Tu nombre
        <input value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} required />
      </label>
      <label>
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Contraseña
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      </label>
      <button type="submit" disabled={enviando}>Crear cuenta</button>
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Entrar</Link>
      </p>
    </form>
  );
}
