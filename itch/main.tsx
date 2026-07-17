import { createRoot } from "react-dom/client";
import "../app/globals.css";
import TimeHeistGame from "../app/game/TimeHeistGame";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing game root element");
}

createRoot(root).render(<TimeHeistGame />);
