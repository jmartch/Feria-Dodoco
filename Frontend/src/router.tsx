import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { RutaProtegida } from "./componentes/RutaProtegida";
import { SoloAdmin } from "./componentes/SoloAdmin";
import { Navegacion } from "./componentes/Navegacion";
import { useAuth } from "./auth/AuthContext";
import { Login } from "./pantallas/Login";
import { Registro } from "./pantallas/Registro";
import { Eventos } from "./pantallas/Eventos";
import { Vender } from "./pantallas/Vender";
import { Panel } from "./pantallas/Panel";
import { Lineas } from "./pantallas/Lineas";
import { Catalogo } from "./pantallas/Catalogo";
import { Configuracion } from "./pantallas/Configuracion";

// Envuelve las pantallas con sesión en la barra de navegación.
function Layout() {
  const { usuario, salir } = useAuth();
  return (
    <>
      {usuario && <Navegacion usuario={usuario} salir={salir} />}
      <main>
        <Outlet />
      </main>
    </>
  );
}

// Rutas sin el BrowserRouter, para poder envolverlas con MemoryRouter en pruebas.
export function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id/vender" element={<Vender />} />
          <Route path="/eventos/:id/panel" element={<Panel />} />
          <Route element={<SoloAdmin />}>
            <Route path="/eventos/:id/lineas" element={<Lineas />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/eventos" replace />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Rutas />
    </BrowserRouter>
  );
}
