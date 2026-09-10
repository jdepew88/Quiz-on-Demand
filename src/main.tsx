import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error('Could not mount Quiz on Demand: no element with id "root" in the document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
