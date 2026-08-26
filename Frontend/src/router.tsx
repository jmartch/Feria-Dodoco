import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RutaProtegida } from "./componentes/RutaProtegida";
import { SoloAdmin } from "./componentes/SoloAdmin";
import { Login } from "./pantallas/Login";
import { Registro } from "./pantallas/Registro";
import { Eventos } from "./pantallas/Eventos";
import { Configuracion } from "./pantallas/Configuracion";

// Rutas sin el BrowserRouter, para poder envolverlas con MemoryRouter en pruebas.
export function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route element={<RutaProtegida />}>
        <Route path="/eventos" element={<Eventos />} />
        <Route element={<SoloAdmin />}>
          <Route path="/configuracion" element={<Configuracion />} />
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
