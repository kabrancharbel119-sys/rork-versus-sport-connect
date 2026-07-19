import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { authRoutes } from "./auth-routes";
import { geniusPayRoutes } from "./geniuspay-routes";
import { registerWebhookHandlers } from "./webhook-handlers";

const app = new Hono();

// Register GeniusPay webhook listeners (payment.succeeded → update DB, etc.)
registerWebhookHandlers();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(
  "*",
  cors({
    origin: allowedOrigins?.length ? allowedOrigins : "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

app.route("/api/auth", authRoutes);
app.route("/api/payments/geniuspay", geniusPayRoutes);

export default app;
