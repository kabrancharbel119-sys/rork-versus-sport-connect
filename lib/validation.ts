import { z } from 'zod';

/** Schémas partagés pour l’auth (client + backend). */

const phoneSchema = z
  .string()
  .min(1, 'Numéro de téléphone requis')
  .transform((s) => s.replace(/\D/g, ''))
  .refine((s) => s.length >= 8 && s.length <= 15, 'Numéro invalide (8 à 15 chiffres)');

const passwordSchema = z
  .string()
  .min(6, 'Minimum 6 caractères')
  .max(200, 'Mot de passe trop long');

const usernameSchema = z
  .string()
  .min(3, '3 caractères minimum')
  .max(20, '20 caractères maximum')
  .regex(/^[a-zA-Z0-9_]+$/, 'Lettres, chiffres et _ uniquement');

export const authValidation = {
  login: z.object({
    phone: phoneSchema,
    password: passwordSchema,
  }),

  register: z.object({
    phone: phoneSchema,
    password: passwordSchema,
    username: usernameSchema,
    fullName: z.string().min(1, 'Nom requis').max(120, 'Nom trop long'),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
  }),
};

export type LoginInput = z.infer<typeof authValidation.login>;
export type RegisterInput = z.infer<typeof authValidation.register>;
