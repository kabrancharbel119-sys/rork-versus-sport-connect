/**
 * Point d'entrée du backend (Node.js ou Bun).
 * Utilisé pour le déploiement sur Railway, Render, Fly.io, VPS, etc.
 *
 * Variables d'environnement requises en production :
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * Optionnelles : PORT, ALLOWED_ORIGINS, RESEND_API_KEY
 */
import { serve } from "@hono/node-server";
import app from "./hono";

const port = Number(process.env.PORT) || 3000;

const server = serve({ fetch: app.fetch, port });
console.log(`Backend running at http://localhost:${port}`);

// Arrêt propre (SIGINT / SIGTERM)
process.on("SIGINT", () => {
  server?.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server?.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
