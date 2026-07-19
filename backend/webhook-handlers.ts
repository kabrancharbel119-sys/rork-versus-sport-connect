/**
 * Handlers des événements webhook GeniusPay.
 *
 * Enregistrés au démarrage du backend via `registerWebhookHandlers()`.
 * Quand GeniusPay envoie un webhook (payment.success, payment.failed, ...),
 * le routeur `geniuspay-routes.ts` vérifie la signature HMAC puis appelle
 * `handleProviderEvent()` qui propage l'événement aux listeners ci-dessous.
 *
 * Les handlers utilisent les `metadata` du paiement pour retrouver le contexte
 * métier (booking / tournament_payment) et mettre à jour le statut en base.
 */
import { onProviderEvent, type ProviderWebhookEvent } from "@/lib/payments/payment-provider";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[WebhookHandlers] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — DB updates will be skipped.");
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Extrait le contexte métier depuis les metadata du webhook.
 * GeniusPay retourne les metadata telles quelles (voir doc API).
 */
function extractContext(event: ProviderWebhookEvent): {
  contextType: string | null;
  contextId: string | null;
  bookingId: string | null;
  tournamentPaymentId: string | null;
  tournamentEntryTournamentId: string | null;
  tournamentEntryTeamId: string | null;
} {
  const raw = (event.rawPayload as any)?.data?.metadata || {};
  const contextType: string | null = raw.context_type || null;
  const contextId: string | null = raw.context_id || null;

  // tournament_entry context: contextId is "tournamentId:teamId"
  const entryParts = contextType === "tournament_entry" && contextId ? contextId.split(":") : [];
  const tournamentEntryTournamentId = entryParts[0] || null;
  const tournamentEntryTeamId = entryParts[1] || null;

  return {
    contextType,
    contextId,
    bookingId: contextType === "booking" ? contextId : raw.booking_id || null,
    tournamentPaymentId: contextType === "tournament_registration" ? contextId : raw.tournament_payment_id || null,
    tournamentEntryTournamentId,
    tournamentEntryTeamId,
  };
}

async function handlePaymentSucceeded(event: ProviderWebhookEvent) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error("[WebhookHandlers] No Supabase admin client available — cannot update DB");
    return;
  }

  const ctx = extractContext(event);
  console.log("[WebhookHandlers] payment.succeeded:", { reference: event.reference, ...ctx });
  console.log("[WebhookHandlers] rawPayload:", JSON.stringify(event.rawPayload).slice(0, 500));

  if (ctx.bookingId) {
    const { error } = await sb
      .from("bookings")
      .update({
        payment_status: "paid",
        payment_transaction_id: event.providerTransactionId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", ctx.bookingId);

    if (error) {
      console.error("[WebhookHandlers] Failed to update booking:", error.message);
    } else {
      console.log("[WebhookHandlers] Booking updated to paid:", ctx.bookingId);
    }
  }

  if (ctx.tournamentPaymentId) {
    const { error } = await sb
      .from("tournament_payments")
      .update({
        status: "approved",
        transaction_ref: event.providerTransactionId,
        validated_at: new Date().toISOString(),
      })
      .eq("id", ctx.tournamentPaymentId);

    if (error) {
      console.error("[WebhookHandlers] Failed to update tournament payment:", error.message);
    } else {
      console.log("[WebhookHandlers] Tournament payment updated to approved:", ctx.tournamentPaymentId);
    }
  }

  // Tournament entry fee payment (in_app_immediate mode)
  if (ctx.tournamentEntryTournamentId && ctx.tournamentEntryTeamId) {
    console.log("[WebhookHandlers] Updating tournament_teams to confirmed:", ctx.tournamentEntryTournamentId, ctx.tournamentEntryTeamId);
    // 1. Confirm the team status
    const { data: updateData, error } = await sb
      .from("tournament_teams")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("tournament_id", ctx.tournamentEntryTournamentId)
      .eq("team_id", ctx.tournamentEntryTeamId)
      .select();

    if (error) {
      console.error("[WebhookHandlers] Failed to confirm tournament team:", error.message, error.code, error.details);
    } else {
      console.log("[WebhookHandlers] Tournament team confirmed, rows affected:", updateData?.length ?? 0, ctx.tournamentEntryTournamentId, ctx.tournamentEntryTeamId);
    }

    // 2. Add team to registered_teams compatibility array
    const { data: tRow } = await sb
      .from("tournaments")
      .select("registered_teams")
      .eq("id", ctx.tournamentEntryTournamentId)
      .single();

    const currentTeams = (tRow?.registered_teams as string[]) || [];
    if (!currentTeams.includes(ctx.tournamentEntryTeamId)) {
      const { error: updErr } = await sb
        .from("tournaments")
        .update({ registered_teams: [...currentTeams, ctx.tournamentEntryTeamId] })
        .eq("id", ctx.tournamentEntryTournamentId);

      if (updErr) console.error("[WebhookHandlers] Failed to add team to registered_teams:", updErr.message);
      else console.log("[WebhookHandlers] Team added to registered_teams:", ctx.tournamentEntryTeamId);
    }
  }

  // Generate invoice for this payment
  await generateInvoice(sb, event, ctx);
}

async function handlePaymentFailed(event: ProviderWebhookEvent) {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const ctx = extractContext(event);
  console.log("[WebhookHandlers] payment.failed:", { reference: event.reference, ...ctx });

  if (ctx.bookingId) {
    const { error } = await sb
      .from("bookings")
      .update({ payment_status: "failed" })
      .eq("id", ctx.bookingId);

    if (error) console.error("[WebhookHandlers] Failed to update booking:", error.message);
  }

  if (ctx.tournamentPaymentId) {
    const { error } = await sb
      .from("tournament_payments")
      .update({ status: "rejected" })
      .eq("id", ctx.tournamentPaymentId);

    if (error) console.error("[WebhookHandlers] Failed to update tournament payment:", error.message);
  }

  // Tournament entry fee payment failed (in_app_immediate mode)
  if (ctx.tournamentEntryTournamentId && ctx.tournamentEntryTeamId) {
    const { error } = await sb
      .from("tournament_teams")
      .update({ status: "rejected" })
      .eq("tournament_id", ctx.tournamentEntryTournamentId)
      .eq("team_id", ctx.tournamentEntryTeamId);

    if (error) console.error("[WebhookHandlers] Failed to reject tournament team:", error.message);
    else console.log("[WebhookHandlers] Tournament team rejected due to payment failure:", ctx.tournamentEntryTournamentId, ctx.tournamentEntryTeamId);
  }
}

async function handlePayoutSent(event: ProviderWebhookEvent) {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const raw = (event.rawPayload as any)?.data?.metadata || {};
  const payoutRequestId = raw.payout_request_id || raw.context_id || null;

  console.log("[WebhookHandlers] payout.sent:", { reference: event.reference, payoutRequestId });

  if (payoutRequestId) {
    const { error } = await sb
      .from("tournament_payout_requests")
      .update({
        disbursement_status: "sent_to_organizer",
        disbursed_at: new Date().toISOString(),
        disbursement_transaction_id: event.providerTransactionId,
      })
      .eq("id", payoutRequestId);

    if (error) console.error("[WebhookHandlers] Failed to update payout request:", error.message);
  }
}

async function handlePayoutFailed(event: ProviderWebhookEvent) {
  console.log("[WebhookHandlers] payout.failed:", { reference: event.reference });
}

/**
 * Generates an invoice record after a successful payment.
 * Uses the existing invoices table schema (document_type, beneficiary_id, etc.).
 * Also stores payer_name, payee_name, event_name, event_id, reason for the admin hub.
 */
async function generateInvoice(
  sb: ReturnType<typeof getSupabaseAdmin>,
  event: ProviderWebhookEvent,
  ctx: ReturnType<typeof extractContext>
) {
  if (!sb) return;
  const raw = (event.rawPayload as any)?.data?.metadata || {};
  const payerId = raw.payer_id || null;

  let payerName: string | null = null;
  let payeeName: string | null = null;
  let payeeId: string | null = null;
  let eventName: string | null = null;
  let eventId: string | null = null;
  let teamName: string | null = null;
  let reason: string = '';
  let description: string = '';
  let contextType: string = ctx.contextType || 'unknown';

  try {
    // Fetch payer name
    if (payerId) {
      const { data: payer } = await sb.from("users").select("full_name, username").eq("id", payerId).single();
      payerName = payer?.full_name || payer?.username || null;
    }

    if (ctx.tournamentEntryTournamentId && ctx.tournamentEntryTeamId) {
      // Tournament entry fee — use 'tournament_registration' as context_type for compatibility
      contextType = 'tournament_registration';
      const { data: t } = await sb.from("tournaments").select("name, created_by").eq("id", ctx.tournamentEntryTournamentId).single();
      const { data: team } = await sb.from("teams").select("name").eq("id", ctx.tournamentEntryTeamId).single();
      teamName = team?.name || null;
      eventName = t?.name || null;
      eventId = ctx.tournamentEntryTournamentId;
      payeeId = t?.created_by || null;
      reason = `Frais d'inscription au tournoi "${t?.name || 'Inconnu'}" — Équipe: ${team?.name || 'Inconnue'}`;
      description = `Inscription équipe ${team?.name || 'Inconnue'} au tournoi ${t?.name || 'Inconnu'}`;

      if (payeeId) {
        const { data: payee } = await sb.from("users").select("full_name, username").eq("id", payeeId).single();
        payeeName = payee?.full_name || payee?.username || null;
      }
    } else if (ctx.bookingId) {
      // Venue booking
      contextType = 'booking';
      const { data: b } = await sb.from("bookings").select("venue_id, user_id").eq("id", ctx.bookingId).single();
      if (b?.venue_id) {
        const { data: v } = await sb.from("venues").select("name, manager_id").eq("id", b.venue_id).single();
        eventName = v?.name || null;
        eventId = b.venue_id;
        payeeId = v?.manager_id || null;
      }
      reason = `Réservation de terrain${eventName ? ` "${eventName}"` : ''}`;
      description = `Réservation de terrain${eventName ? ` "${eventName}"` : ''}`;
      if (payeeId) {
        const { data: payee } = await sb.from("users").select("full_name, username").eq("id", payeeId).single();
        payeeName = payee?.full_name || payee?.username || null;
      }
    } else if (ctx.tournamentPaymentId) {
      // Tournament registration payment (legacy)
      contextType = 'tournament_registration';
      const { data: tp } = await sb.from("tournament_payments").select("tournament_id, team_id").eq("id", ctx.tournamentPaymentId).single();
      if (tp?.tournament_id) {
        const { data: t } = await sb.from("tournaments").select("name, created_by").eq("id", tp.tournament_id).single();
        eventName = t?.name || null;
        eventId = tp.tournament_id;
        payeeId = t?.created_by || null;
      }
      reason = `Paiement d'inscription au tournoi "${eventName || 'Inconnu'}"`;
      description = `Paiement d'inscription au tournoi "${eventName || 'Inconnu'}"`;
      if (payeeId) {
        const { data: payee } = await sb.from("users").select("full_name, username").eq("id", payeeId).single();
        payeeName = payee?.full_name || payee?.username || null;
      }
    }

    // Check for duplicate invoice
    const { data: existing } = await sb
      .from("invoices")
      .select("id")
      .eq("context_type", contextType)
      .eq("context_id", ctx.contextId || '')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log("[WebhookHandlers] Invoice already exists for", contextType, ctx.contextId);
      return;
    }

    // Generate invoice number using existing DB function
    const { data: numberData, error: numberError } = await sb.rpc("generate_invoice_number", { p_prefix: "INV" });
    if (numberError) throw numberError;
    const invoiceNumber = numberData as string;

    const now = new Date().toISOString();
    const { error: invErr } = await sb.from("invoices").insert({
      invoice_number: invoiceNumber,
      document_type: 'invoice',
      context_type: contextType,
      context_id: ctx.contextId || '',
      amount: event.amount,
      currency: event.currency || 'XOF',
      payer_id: payerId,
      beneficiary_id: payeeId,
      description,
      payment_method: 'in_app',
      payment_transaction_id: event.providerTransactionId || event.reference,
      status: 'paid',
      issued_at: now,
      paid_at: now,
      metadata: teamName ? { team_name: teamName } : {},
      payer_name: payerName,
      payee_name: payeeName,
      event_name: eventName,
      event_id: eventId,
      reason,
    });

    if (invErr) {
      console.error("[WebhookHandlers] Failed to create invoice:", invErr.message);
    } else {
      console.log("[WebhookHandlers] Invoice created:", invoiceNumber, "for", reason);
    }
  } catch (e) {
    console.error("[WebhookHandlers] Invoice generation error:", (e as Error)?.message);
  }
}

/**
 * À appeler une seule fois au démarrage du backend.
 * Enregistre tous les listeners sur les événements webhook GeniusPay.
 */
export function registerWebhookHandlers(): void {
  onProviderEvent(async (event: ProviderWebhookEvent) => {
    switch (event.type) {
      case "payment.succeeded":
        await handlePaymentSucceeded(event);
        break;
      case "payment.failed":
        await handlePaymentFailed(event);
        break;
      case "payout.sent":
        await handlePayoutSent(event);
        break;
      case "payout.failed":
        await handlePayoutFailed(event);
        break;
      default:
        console.log("[WebhookHandlers] Unhandled event type:", event.type);
    }
  });

  console.log("[WebhookHandlers] Registered GeniusPay webhook listeners");
}
