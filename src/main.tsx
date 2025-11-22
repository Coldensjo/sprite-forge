import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize debug control (exposes window.__debugControl)
import "./lib/debugControl";

createRoot(document.getElementById("root")!).render(<App />);
