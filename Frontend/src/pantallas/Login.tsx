import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorApi } from "../api/tipos";
import { Aviso } from "../componentes/Aviso";

export function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await entrar(email, password);
      navegar("/eventos");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo entrar. Revisa tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <h1>Entrar</h1>
      {error && <Aviso mensaje={error} />}
      <label>
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Contraseña
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button type="submit" disabled={enviando}>Entrar</button>
      <p>
        ¿No tienes cuenta? <Link to="/registro">Crea tu emprendimiento</Link>
      </p>
    </form>
  );
}
