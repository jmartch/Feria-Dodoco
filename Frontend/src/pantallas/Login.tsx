import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    await entrar(email, password);
    navegar("/eventos");
  }

  return (
    <form onSubmit={enviar}>
      <h1>Entrar</h1>
      <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button type="submit">Entrar</button>
    </form>
  );
}
