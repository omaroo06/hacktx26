import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/nunito/index.css";
import "@fontsource/silkscreen/400.css";
import "./styles/index.css";
import "./styles/components.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
