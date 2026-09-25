import { cpSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function publicWithoutGrok(): Plugin {
  return {
    name: "aerie-public",
    apply: "build",
    closeBundle() {
      const src = resolve("public");
      const dest = resolve("docs");
      mkdirSync(dest, { recursive: true });
      for (const name of readdirSync(src)) {
        if (name === "__grok") continue;
        const from = join(src, name);
        const to = join(dest, name);
        if (statSync(from).isDirectory()) cpSync(from, to, { recursive: true });
        else cpSync(from, to);
      }
    },
  };
}

export default defineConfig({
  root: "pages",
  base: "/Aerie/",
  publicDir: false,
  resolve: { alias: { "@": resolve("src") } },
  plugins: [react(), tailwindcss(), publicWithoutGrok()],
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
