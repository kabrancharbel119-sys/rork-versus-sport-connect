/**
 * Script pour confirmer les billets pending_payment ET générer les factures
 * manquantes pour les billets déjà confirmés.
 *
 * Usage: npx tsx scripts/confirm-pending-tickets.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variables d'environnement manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function confirmPendingTickets() {
  const { data: pendingTickets, error: fetchError } = await sb
    .from("tickets")
    .select("id, payment_transaction_id, buyer_id, ticket_type_id, price_paid, event_type, event_id")
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false });

  if (fetchError) {
    console.error("❌ Erreur:", fetchError.message);
    return;
  }

  if (!pendingTickets || pendingTickets.length === 0) {
    console.log("✅ Aucun billet en attente de paiement.");
    return;
  }

  console.log(`📋 ${pendingTickets.length} billet(s) en attente.\n`);

  const byPaymentRef = new Map<string, typeof pendingTickets>();
  for (const t of pendingTickets) {
    const ref = t.payment_transaction_id || "unknown";
    if (!byPaymentRef.has(ref)) byPaymentRef.set(ref, []);
    byPaymentRef.get(ref)!.push(t);
  }

  for (const [paymentRef, tickets] of byPaymentRef) {
    console.log(`  Référence: ${paymentRef}`);
    console.log(`  Billets: ${tickets.length} × ${tickets[0].price_paid} FCFA = ${tickets.reduce((s, t) => s + t.price_paid, 0)} FCFA`);

    const { data: confirmedCount, error: confirmError } = await sb.rpc("confirm_ticket_payment", {
      p_payment_transaction_id: paymentRef,
    });

    if (confirmError) {
      console.error(`  ❌ Erreur: ${confirmError.message}\n`);
      continue;
    }

    console.log(`  ✅ ${confirmedCount} billet(s) confirmé(s) !`);

    const buyerId = tickets[0].buyer_id;
    await sb.from("notifications").insert({
      user_id: buyerId,
      type: "system",
      title: "🎟️ Billets confirmés",
      message: "Votre paiement a été confirmé. Vos billets sont disponibles dans \"Mes billets\".",
      data: { route: "/my-tickets" },
    });
    console.log(`  📬 Notification envoyée.\n`);
  }
}

async function generateMissingInvoices() {
  console.log("\n📄 Génération des factures manquantes...\n");

  const { data: validTickets, error } = await sb
    .from("tickets")
    .select("payment_transaction_id")
    .eq("status", "valid")
    .not("payment_transaction_id", "is", null);

  if (error) {
    console.error("❌ Erreur:", error.message);
    return;
  }

  if (!validTickets || validTickets.length === 0) {
    console.log("✅ Aucun billet valide trouvé.");
    return;
  }

  const refs = [...new Set(validTickets.map(t => t.payment_transaction_id).filter(Boolean))] as string[];
  let created = 0;

  for (const ref of refs) {
    const { data: existing } = await sb
      .from("invoices")
      .select("id, invoice_number")
      .eq("context_type", "ticket_purchase")
      .eq("context_id", ref)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  ⏭️  Facture existante pour ${ref}: ${(existing[0] as any).invoice_number}`);
      continue;
    }

    const { data: invoice, error: invError } = await sb.rpc("create_invoice_for_ticket_purchase", {
      p_payment_transaction_id: ref,
      p_provider_reference: null,
    });

    if (invError) {
      console.error(`  ❌ Erreur facture pour ${ref}: ${invError.message}`);
    } else if (invoice) {
      console.log(`  ✅ Facture créée: ${(invoice as any).invoice_number} pour ${ref}`);
      created++;
    }
  }

  console.log(`\n📊 ${created} facture(s) créée(s).`);
}

async function main() {
  console.log("=== Confirmation des billets et génération des factures ===\n");
  await confirmPendingTickets();
  await generateMissingInvoices();
  console.log("\n✅ Terminé !");
}

main().catch((e) => {
  console.error("❌ Erreur fatale:", e);
  process.exit(1);
});
