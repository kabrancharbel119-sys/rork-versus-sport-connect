/**
 * Couche d'abstraction du fournisseur de paiement.
 *
 * GeniusPay (agrégateur) est implémenté via `GeniusPayProvider` ci-dessous.
 * Le client (app RN) n'appelle JAMAIS geniuspay.ci directement : toutes les
 * requêtes passent par le backend (`backend/geniuspay-routes.ts`), qui seul
 * détient les clés secrètes (X-API-Secret). Voir aussi le webhook backend
 * (`POST /api/payments/geniuspay/webhook`) qui vérifie la signature HMAC et
 * appelle `handleProviderEvent` ci-dessous pour propager les événements
 * (payment.success, payment.failed, ...) au reste de l'app.
 *
 * NOTE : la documentation GeniusPay fournie ne décrit pas d'endpoint public
 * pour *créer* un décaissement (payout/cashout) — seulement des événements
 * webhook (`cashout.requested/approved/completed/failed`), qui semblent
 * déclenchés depuis le dashboard GeniusPay. `initiatePayout` retourne donc
 * une erreur explicite tant qu'un endpoint de création de payout n'est pas
 * confirmé.
 */
import { getApiBaseUrl } from '@/lib/api-base-url';

// =============================================
// TYPES
// =============================================

export type PaymentIntentStatus = 'initiated' | 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface PaymentIntent {
  /** Identifiant interne (référence métier) */
  reference: string;
  /** Identifiant chez le fournisseur (GeniusPay) */
  providerTransactionId?: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  /** Contexte métier: booking | tournament_registration | ... */
  contextType: string;
  contextId: string;
  payerId?: string;
  /** URL de redirection après succès (deep link app ou page web) */
  successUrl?: string;
  /** URL de redirection après échec */
  errorUrl?: string;
  /** Infos client pour le fournisseur de paiement */
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  createdAt: Date;
}

export interface PayoutRequestPayload {
  /** Référence métier (ex: payout_request id) */
  reference: string;
  amount: number;
  currency: string;
  /** Numéro de téléphone destinataire (Wave/Orange via agrégateur) */
  recipientPhone: string;
  recipientName?: string;
  /** Contexte: venue_advance | logistics_advance | organizer_release */
  contextType: string;
  contextId: string;
}

export interface ProviderResult {
  success: boolean;
  providerTransactionId?: string;
  /** URL de redirection pour finaliser le paiement (si applicable) */
  checkoutUrl?: string;
  error?: string;
}

export interface ProviderWebhookEvent {
  /** Identifiant unique de l'événement (pour idempotence) */
  eventId: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded' | 'payout.sent' | 'payout.failed';
  providerTransactionId: string;
  reference: string;
  amount: number;
  currency: string;
  rawPayload: Record<string, any>;
}

/**
 * Interface que tout fournisseur de paiement doit implémenter.
 */
export interface PaymentProvider {
  readonly name: string;
  /** Le fournisseur est-il configuré et opérationnel ? */
  isConfigured(): boolean;
  /** Initier un encaissement (paiement client -> plateforme) */
  initiatePayment(intent: Omit<PaymentIntent, 'status' | 'createdAt' | 'providerTransactionId'>): Promise<ProviderResult>;
  /** Initier un décaissement (plateforme -> bénéficiaire) */
  initiatePayout(payload: PayoutRequestPayload): Promise<ProviderResult>;
  /** Vérifier l'état d'une transaction côté fournisseur (reconciliation) */
  verifyTransaction(providerTransactionId: string): Promise<PaymentIntentStatus>;
}

// =============================================
// IMPLÉMENTATION PLACEHOLDER (fallback sans backend)
// =============================================

/**
 * Fournisseur "non configuré" : toutes les opérations échouent proprement
 * avec un message explicite. Utilisé en fallback quand aucune base URL
 * backend n'est configurée (EXPO_PUBLIC_RORK_API_BASE_URL manquante).
 */
class NotConfiguredProvider implements PaymentProvider {
  readonly name = 'not_configured';

  isConfigured(): boolean {
    return false;
  }

  async initiatePayment(): Promise<ProviderResult> {
    return {
      success: false,
      error: 'Aucun fournisseur de paiement configuré. L’intégration GeniusPay est en attente.',
    };
  }

  async initiatePayout(): Promise<ProviderResult> {
    return {
      success: false,
      error: 'Aucun fournisseur de paiement configuré. L’intégration GeniusPay est en attente.',
    };
  }

  async verifyTransaction(): Promise<PaymentIntentStatus> {
    return 'failed';
  }
}

// =============================================
// GENIUSPAY PROVIDER
// =============================================

/** Statuts GeniusPay (voir doc) -> statut interne normalisé. */
function mapGeniusPayStatus(status: string | undefined): PaymentIntentStatus {
  switch (status) {
    case 'completed':
      return 'succeeded';
    case 'pending':
    case 'processing':
      return 'pending';
    case 'refunded':
      return 'refunded';
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Fournisseur GeniusPay. N'appelle jamais geniuspay.ci directement : passe
 * systématiquement par le backend (`backend/geniuspay-routes.ts`), seul
 * détenteur des clés secrètes X-API-Key / X-API-Secret.
 */
class GeniusPayProvider implements PaymentProvider {
  readonly name = 'geniuspay';

  private get relayBaseUrl(): string {
    const base = getApiBaseUrl();
    return base ? `${base}/api/payments/geniuspay` : '';
  }

  isConfigured(): boolean {
    // La vérification des clés secrètes (GENIUSPAY_API_KEY/SECRET) se fait
    // côté backend. Ici on vérifie seulement qu'un backend est joignable.
    return !!this.relayBaseUrl;
  }

  async initiatePayment(
    intent: Omit<PaymentIntent, 'status' | 'createdAt' | 'providerTransactionId'>
  ): Promise<ProviderResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Backend GeniusPay non configuré (EXPO_PUBLIC_RORK_API_BASE_URL manquant).' };
    }

    try {
      const res = await fetch(`${this.relayBaseUrl}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: intent.amount,
          currency: intent.currency || 'XOF',
          success_url: intent.successUrl,
          error_url: intent.errorUrl,
          customer: intent.customer,
          metadata: {
            context_type: intent.contextType,
            context_id: intent.contextId,
            payer_id: intent.payerId,
          },
        }),
      });

      const body = await res.json().catch(() => null);
      console.log('[GeniusPayProvider] Response:', { status: res.status, body: JSON.stringify(body).slice(0, 500) });

      if (!res.ok) {
        return { success: false, error: body?.error?.message || body?.message || `Échec de la création du paiement (HTTP ${res.status}).` };
      }

      // GeniusPay may return different formats: { success: true, data: {...} } or { status: "success", data: {...} } or direct fields
      const isSuccess = body?.success === true || body?.status === 'success' || body?.status === 'pending' || !!body?.data?.checkout_url || !!body?.data?.payment_url || !!body?.checkout_url;
      if (!isSuccess) {
        return { success: false, error: body?.error?.message || body?.message || `Réponse inattendue de GeniusPay: ${JSON.stringify(body).slice(0, 200)}` };
      }

      const data = body?.data || body;
      return {
        success: true,
        providerTransactionId: data?.reference || data?.id || data?.transaction_id,
        checkoutUrl: data?.checkout_url || data?.payment_url || data?.redirect_url,
      };
    } catch (e) {
      return { success: false, error: (e as Error)?.message || 'Erreur réseau lors de la création du paiement GeniusPay.' };
    }
  }

  async initiatePayout(): Promise<ProviderResult> {
    // La documentation GeniusPay fournie ne décrit aucun endpoint public pour
    // créer un décaissement (payout/cashout) — seulement des événements
    // webhook (cashout.requested/approved/completed/failed), déclenchés
    // depuis le dashboard GeniusPay. Tant qu'un endpoint de création n'est
    // pas confirmé, cette opération n'est pas supportée.
    return {
      success: false,
      error: 'GeniusPay : aucun endpoint de création de payout documenté. Les décaissements se font actuellement via le dashboard GeniusPay.',
    };
  }

  async verifyTransaction(providerTransactionId: string): Promise<PaymentIntentStatus> {
    if (!this.isConfigured()) return 'failed';

    try {
      const res = await fetch(`${this.relayBaseUrl}/status/${encodeURIComponent(providerTransactionId)}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) return 'failed';
      return mapGeniusPayStatus(body.data?.status);
    } catch {
      return 'failed';
    }
  }
}

// =============================================
// TRAITEMENT DES ÉVÉNEMENTS WEBHOOK (serveur)
// =============================================

type ProviderEventListener = (event: ProviderWebhookEvent) => void | Promise<void>;
const webhookEventListeners: ProviderEventListener[] = [];

/**
 * Permet d'enregistrer un listener appelé à chaque événement webhook
 * GeniusPay reçu (payment.success, payment.failed, ...). À utiliser côté
 * backend uniquement pour brancher la logique métier (mise à jour DB,
 * notifications, etc.) sans coupler ce module à un flux spécifique.
 */
export function onProviderEvent(listener: ProviderEventListener): () => void {
  webhookEventListeners.push(listener);
  return () => {
    const idx = webhookEventListeners.indexOf(listener);
    if (idx >= 0) webhookEventListeners.splice(idx, 1);
  };
}

/**
 * Appelé par le webhook backend (`backend/geniuspay-routes.ts`) après
 * vérification de signature, pour propager l'événement aux listeners
 * métier enregistrés via `onProviderEvent`.
 */
export async function handleProviderEvent(event: ProviderWebhookEvent): Promise<void> {
  for (const listener of webhookEventListeners) {
    try {
      await listener(event);
    } catch (e) {
      console.warn('[PaymentProvider] Webhook listener failed:', (e as Error)?.message ?? e);
    }
  }
}

// =============================================
// POINT D'ENTRÉE UNIQUE
// =============================================

/**
 * Instance GeniusPay, exportée séparément pour un branchement volontaire.
 *
 * ATTENTION avant de l'assigner à `paymentProvider` ci-dessous : GeniusPay
 * (sans `payment_method`) retourne un statut `pending` + `checkout_url` à la
 * création — le paiement n'est confirmé qu'après webhook `payment.success`.
 * Les écrans actuels (`app/venue/[id].tsx`, `app/manager/scan-qr.tsx`)
 * traitent un `initiatePayment()` réussi comme un paiement déjà confirmé et
 * valident immédiatement la réservation. Il faut d'abord les adapter pour
 * rediriger vers `checkoutUrl` et attendre la confirmation webhook avant de
 * activer GeniusPay ici, sous peine de confirmer des réservations non payées.
 */
export const geniusPayProvider: PaymentProvider = new GeniusPayProvider();

/**
 * Instance active du fournisseur de paiement utilisée par les écrans.
 * GeniusPay est maintenant activé : les écrans gèrent le flux asynchrone
 * (redirection checkoutUrl → attente confirmation webhook).
 */
export const paymentProvider: PaymentProvider = geniusPayProvider;

/**
 * Indique si le paiement in-app automatisé est disponible.
 * Les écrans peuvent l'utiliser pour afficher/masquer les options
 * de paiement in-app instantané vs le flux manuel actuel (preuve Wave/Orange).
 */
export function isInAppPaymentAvailable(): boolean {
  return paymentProvider.isConfigured();
}
