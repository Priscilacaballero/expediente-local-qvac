import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("No se encontró el contenedor de la aplicación");
createRoot(root).render(<StrictMode><App /></StrictMode>);
