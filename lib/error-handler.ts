/**
 * Gestionnaire d'erreurs centralisé avec intégration Sentry
 */

import * as Sentry from '@sentry/react-native';
import { logger } from './logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  public code: string;
  public context?: ErrorContext;
  public originalError?: Error;

  constructor(message: string, code: string, context?: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.originalError = originalError;
  }
}

/**
 * Catégories d'erreurs
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Détermine la catégorie d'une erreur
 */
function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch')) {
    return ErrorCategory.NETWORK;
  }
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
    return ErrorCategory.AUTH;
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorCategory.VALIDATION;
  }
  if (message.includes('permission') || message.includes('forbidden')) {
    return ErrorCategory.PERMISSION;
  }
  if (message.includes('not found') || message.includes('404')) {
    return ErrorCategory.NOT_FOUND;
  }
  if (message.includes('500') || message.includes('server error')) {
    return ErrorCategory.SERVER;
  }
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Détermine si une erreur doit être loggée dans Sentry
 */
function shouldLogToSentry(category: ErrorCategory): boolean {
  // Ne pas logger les erreurs de validation et not found (trop fréquentes)
  return ![ErrorCategory.VALIDATION, ErrorCategory.NOT_FOUND].includes(category);
}

/**
 * Obtient un message utilisateur friendly
 */
export function getUserFriendlyMessage(error: Error, category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.NETWORK:
      return 'Problème de connexion. Vérifiez votre connexion internet.';
    case ErrorCategory.AUTH:
      return 'Session expirée. Veuillez vous reconnecter.';
    case ErrorCategory.VALIDATION:
      return 'Données invalides. Veuillez vérifier vos informations.';
    case ErrorCategory.PERMISSION:
      return 'Vous n\'avez pas les permissions nécessaires.';
    case ErrorCategory.NOT_FOUND:
      return 'Ressource introuvable.';
    case ErrorCategory.SERVER:
      return 'Erreur serveur. Veuillez réessayer plus tard.';
    default:
      return 'Une erreur est survenue. Veuillez réessayer.';
  }
}

/**
 * Gère une erreur de manière centralisée
 */
export function handleError(error: Error | AppError, context?: ErrorContext): {
  message: string;
  category: ErrorCategory;
  shouldRetry: boolean;
} {
  const category = categorizeError(error);
  const userMessage = getUserFriendlyMessage(error, category);
  
  // Logger dans la console en dev
  if (__DEV__) {
    logger.error('ErrorHandler', error.message, { category, context, stack: error.stack });
  }
  
  // Logger dans Sentry en production
  if (!__DEV__ && shouldLogToSentry(category)) {
    Sentry.captureException(error, {
      tags: {
        category,
        component: context?.component,
        action: context?.action,
      },
      extra: {
        context,
        userId: context?.userId,
        metadata: context?.metadata,
      },
    });
  }
  
  // Déterminer si l'utilisateur devrait réessayer
  const shouldRetry = [
    ErrorCategory.NETWORK,
    ErrorCategory.SERVER,
  ].includes(category);
  
  return {
    message: userMessage,
    category,
    shouldRetry,
  };
}

/**
 * Wrapper pour les appels API avec retry automatique
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    context?: ErrorContext;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, context } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const category = categorizeError(lastError);
      
      // Ne retry que pour les erreurs réseau et serveur
      if (![ErrorCategory.NETWORK, ErrorCategory.SERVER].includes(category)) {
        throw error;
      }
      
      // Dernier essai, on throw
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      logger.debug('ErrorHandler', `Retry ${attempt}/${maxRetries} après ${delay}ms`, { context });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Wrapper pour les mutations React Query avec gestion d'erreur
 */
export function createMutationErrorHandler(context: ErrorContext) {
  return (error: Error) => {
    const result = handleError(error, context);
    
    // Retourner le message pour l'afficher à l'utilisateur
    return result.message;
  };
}

/**
 * Initialise Sentry si le DSN est configuré
 */
export function initializeErrorReporting() {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  
  if (sentryDsn && !__DEV__) {
    Sentry.init({
      dsn: sentryDsn,
      debug: false,
      tracesSampleRate: 0.2, // 20% des transactions
      beforeSend(event) {
        // Filtrer les données sensibles
        if (event.request?.data) {
          const data = event.request.data as Record<string, unknown>;
          if (data.password) delete data.password;
          if (data.token) delete data.token;
        }
        return event;
      },
    });
    
    logger.debug('ErrorHandler', 'Sentry initialized');
  }
}
