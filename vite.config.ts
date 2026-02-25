import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/notculture-board-game/",
  plugins: [react(), tailwindcss()],
}));
