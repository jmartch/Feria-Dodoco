import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
    // Carga .env antes de cualquier import: los servicios exigen sus secretos
    // al evaluarse y deben fallar si faltan, no caer en un valor por defecto.
    setupFiles: ["dotenv/config"],
  },
});
