import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { fileURLToPath, URL } from "node:url"

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: r("./src/$1") },
      { find: "seslen/presets", replacement: r("../src/presets/index.ts") },
      { find: "seslen/server", replacement: r("../src/server.ts") },
      { find: /^seslen$/, replacement: r("../src/index.ts") },
    ],
  },
  server: {
    port: 5173,
    fs: {
      allow: [r("..")],
    },
  },
})
