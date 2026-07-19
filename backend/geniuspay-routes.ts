/**
 * Routes backend GeniusPay (agrégateur de paiement mobile money / carte).
 *
 * IMPORTANT SÉCURITÉ :
 * - X-API-Secret ne doit JAMAIS être exposée côté client. Toutes les requêtes
 *   vers l'API GeniusPay passent donc obligatoirement par ce backend.
 * - Le client (app RN) n'appelle jamais geniuspay.ci directement : il appelle
 *   ce backend (/api/payments/geniuspay/*), qui relaie avec les clés secrètes.
 *
 * Variables d'environnement requises sur le serveur (jamais préfixées EXPO_PUBLIC_) :
 * - GENIUSPAY_API_KEY      (pk_sandbox_xxx ou pk_live_xxx)
 * - GENIUSPAY_API_SECRET   (sk_sandbox_xxx ou sk_live_xxx)
 * - GENIUSPAY_WEBHOOK_SECRET (whsec_sandbox_xxx ou whsec_live_xxx)
 * Optionnelle :
 * - GENIUSPAY_BASE_URL (défaut : https://geniuspay.ci/api/v1/merchant)
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { handleProviderEvent, type ProviderWebhookEvent } from "@/lib/payments/payment-provider";

const GENIUSPAY_BASE_URL = (process.env.GENIUSPAY_BASE_URL || "https://geniuspay.ci/api/v1/merchant").replace(/\/+$/, "");

function isGeniusPayConfigured(): boolean {
  return !!process.env.GENIUSPAY_API_KEY && !!process.env.GENIUSPAY_API_SECRET;
}

function geniusPayHeaders(): Record<string, string> {
  const apiKey = process.env.GENIUSPAY_API_KEY;
  const apiSecret = process.env.GENIUSPAY_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new HTTPException(500, { message: "GeniusPay n'est pas configuré côté serveur (GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET manquants)." });
  }
  return {
    "X-API-Key": apiKey,
    "X-API-Secret": apiSecret,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

// =============================================================
// Dédoublonnage best-effort des webhooks (en mémoire)
// TODO production : persister les eventId traités en base pour
// garantir l'idempotence entre redémarrages / instances multiples.
// =============================================================
const processedWebhookEventIds = new Set<string>();
const MAX_TRACKED_EVENT_IDS = 5000;

function markEventProcessed(eventId: string): boolean {
  if (processedWebhookEventIds.has(eventId)) return false;
  if (processedWebhookEventIds.size >= MAX_TRACKED_EVENT_IDS) {
    processedWebhookEventIds.clear();
  }
  processedWebhookEventIds.add(eventId);
  return true;
}

/** Vérifie signature = HMAC-SHA256(timestamp + "." + json_payload, secret). */
function verifyWebhookSignature(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const { createHmac, timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const signatureBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

const createPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional(),
  payment_method: z.string().optional(),
  gateway: z.string().optional(),
  mmo_provider: z.string().optional(),
  description: z.string().max(500).optional(),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  success_url: z.string().optional(),
  error_url: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const geniusPayRoutes = new Hono();

/**
 * POST /api/payments/geniuspay/create
 * Relaie la création de paiement vers GeniusPay avec les clés secrètes.
 */
geniusPayRoutes.post("/create", async (c) => {
  if (!isGeniusPayConfigured()) {
    throw new HTTPException(503, { message: "GeniusPay n'est pas configuré." });
  }

  const json = await c.req.json().catch(() => null);
  const parsed = createPaymentSchema.safeParse(json);
  if (!parsed.success) {
    throw new HTTPException(422, { message: parsed.error.issues.map((i) => i.message).join(", ") });
  }

  const requestBody = JSON.stringify(parsed.data);
  console.log("[GeniusPay] Sending to:", `${GENIUSPAY_BASE_URL}/payments`);
  console.log("[GeniusPay] Request body:", requestBody.slice(0, 500));

  const res = await fetch(`${GENIUSPAY_BASE_URL}/payments`, {
    method: "POST",
    headers: geniusPayHeaders(),
    body: requestBody,
  });

  const rawText = await res.text();
  console.log("[GeniusPay] Raw response:", rawText.slice(0, 1000));
  console.log("[GeniusPay] Response status:", res.status);
  console.log("[GeniusPay] Response headers:", JSON.stringify(Object.fromEntries(res.headers.entries())));

  let body: any;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = { raw: rawText };
  }
  return c.json(body, res.status as any);
});

/**
 * GET /api/payments/geniuspay/status/:reference
 * Relaie la récupération d'une transaction (réconciliation / vérification).
 */
geniusPayRoutes.get("/status/:reference", async (c) => {
  if (!isGeniusPayConfigured()) {
    throw new HTTPException(503, { message: "GeniusPay n'est pas configuré." });
  }

  const reference = c.req.param("reference");
  if (!reference?.trim()) {
    throw new HTTPException(422, { message: "Référence manquante." });
  }

  const res = await fetch(`${GENIUSPAY_BASE_URL}/payments/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: geniusPayHeaders(),
  });

  const body = await res.json().catch(() => ({}));
  return c.json(body, res.status as any);
});

/**
 * POST /api/payments/geniuspay/webhook
 * Réception des notifications GeniusPay (payment.success, payment.failed, etc.).
 * Vérifie la signature HMAC-SHA256 avant tout traitement.
 */
geniusPayRoutes.post("/webhook", async (c) => {
  const signature = c.req.header("X-Webhook-Signature");
  const timestamp = c.req.header("X-Webhook-Timestamp");
  const event = c.req.header("X-Webhook-Event");
  const environment = c.req.header("X-Webhook-Environment");
  const rawBody = await c.req.text();

  if (!signature || !timestamp) {
    throw new HTTPException(401, { message: "Signature ou timestamp manquant." });
  }

  if (!verifyWebhookSignature(rawBody, timestamp, signature)) {
    throw new HTTPException(401, { message: "Signature invalide." });
  }

  // Protection replay attack (5 minutes, comme recommandé par GeniusPay).
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    throw new HTTPException(400, { message: "Timestamp trop ancien." });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new HTTPException(400, { message: "Payload JSON invalide." });
  }

  const eventId: string | undefined = payload?.id;
  if (eventId && !markEventProcessed(eventId)) {
    // Déjà traité : on répond 200 sans retraiter (idempotence).
    return c.json({ success: true, deduplicated: true });
  }

  console.log(`[GeniusPay Webhook] event=${event} environment=${environment} reference=${payload?.data?.reference}`);

  const mappedType = mapWebhookEventType(event, payload?.event);
  if (mappedType && payload?.data) {
    const providerEvent: ProviderWebhookEvent = {
      eventId: eventId || `${event}-${timestamp}`,
      type: mappedType,
      providerTransactionId: payload.data.reference,
      reference: payload.data.reference,
      amount: payload.data.amount,
      currency: payload.data.currency,
      rawPayload: payload,
    };
    await handleProviderEvent(providerEvent);
  }

  return c.json({ success: true });
});

/** Traduit un événement GeniusPay (payment.* / cashout.*) vers le type interne ProviderWebhookEvent. */
function mapWebhookEventType(
  headerEvent: string | undefined,
  payloadEvent: string | undefined
): ProviderWebhookEvent["type"] | null {
  const evt = headerEvent || payloadEvent;
  switch (evt) {
    case "payment.success":
      return "payment.succeeded";
    case "payment.failed":
    case "payment.cancelled":
    case "payment.expired":
      return "payment.failed";
    case "payment.refunded":
      return "payment.refunded";
    case "cashout.completed":
      return "payout.sent";
    case "cashout.failed":
      return "payout.failed";
    default:
      // payment.initiated, cashout.requested, cashout.approved, webhook.test :
      // pas de type interne équivalent pour l'instant, on log seulement.
      return null;
  }
}
