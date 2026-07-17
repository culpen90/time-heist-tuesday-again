import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./itch", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    assetsDir: "assets",
    emptyOutDir: true,
    outDir: fileURLToPath(new URL("./dist-itch", import.meta.url)),
    sourcemap: false,
    target: "es2022",
  },
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
});
