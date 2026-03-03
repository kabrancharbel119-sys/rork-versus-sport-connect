/**
 * Routes d'auth backend : login / register.
 * Utiliser en production avec EXPO_PUBLIC_USE_BACKEND_AUTH=true.
 * Nécessite SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sur le serveur.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const hashSalt = "vs_salt_2024";

/** Hash legacy (SHA256) : conservé pour les comptes existants. */
function hashPasswordLegacy(password: string): string {
  try {
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    return createHash("sha256").update(password + hashSalt).digest("hex");
  } catch {
    const c = require("crypto") as {
      createHash: (a: string) => { update: (b: string) => { digest: (e: string) => string } };
    };
    return c.createHash("sha256").update(password + hashSalt).digest("hex");
  }
}

/** Hash pour nouveaux comptes (bcrypt). */
function hashPasswordBcrypt(password: string): string {
  const bcrypt = require("bcryptjs") as { hashSync: (s: string, r: number) => string };
  return bcrypt.hashSync(password, 10);
}

/** Vérifie le mot de passe : bcrypt si hash commence par $2, sinon legacy SHA256. */
function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith("$2")) {
    const bcrypt = require("bcryptjs") as { compareSync: (s: string, h: string) => boolean };
    return bcrypt.compareSync(password, storedHash);
  }
  return hashPasswordLegacy(password) === storedHash;
}

const loginSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(6).max(200),
}).refine(data => data.email || data.phone, {
  message: "Email ou téléphone requis",
});

const registerSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  fullName: z.string().min(1).max(120),
  phone: z.string().optional(),
  password: z.string().min(6).max(200),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
}).refine(data => data.email || data.phone, {
  message: "Email ou téléphone requis",
});

/** Colonnes user sans password_hash pour les réponses */
const USER_PUBLIC_COLUMNS =
  "id,email,username,full_name,avatar,phone,city,country,bio,sports,stats,reputation,wallet_balance,teams,followers,following,is_verified,is_premium,is_banned,role,location_lat,location_lng,location_city,location_country,availability,referral_code,created_at";

type DbRow = Record<string, unknown>;

/** Même forme que le type User côté client (camelCase) */
function mapRowToUser(row: DbRow) {
  const stats = (row.stats as Record<string, number>) ?? {};
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.full_name,
    avatar: row.avatar ?? undefined,
    phone: row.phone ?? undefined,
    city: row.city ?? "",
    country: row.country ?? "",
    bio: row.bio ?? undefined,
    sports: (row.sports as unknown[]) ?? [],
    stats: {
      matchesPlayed: stats.matchesPlayed ?? 0,
      wins: stats.wins ?? 0,
      losses: stats.losses ?? 0,
      draws: stats.draws ?? 0,
      goalsScored: stats.goalsScored ?? 0,
      assists: stats.assists ?? 0,
      mvpAwards: stats.mvpAwards ?? 0,
      fairPlayScore: stats.fairPlayScore ?? 5,
      tournamentWins: stats.tournamentWins ?? 0,
      totalCashPrize: stats.totalCashPrize ?? 0,
    },
    reputation: (row.reputation as number) ?? 5,
    walletBalance: (row.wallet_balance as number) ?? 0,
    teams: (row.teams as string[]) ?? [],
    followers: (row.followers as number) ?? 0,
    following: (row.following as number) ?? 0,
    isVerified: (row.is_verified as boolean) ?? false,
    isPremium: (row.is_premium as boolean) ?? false,
    isBanned: (row.is_banned as boolean) ?? false,
    role: (row.role as string) ?? "user",
    location:
      row.location_lat != null && row.location_lng != null
        ? {
            latitude: row.location_lat,
            longitude: row.location_lng,
            city: (row.location_city as string) ?? "",
            country: (row.location_country as string) ?? "",
            lastUpdated: new Date(),
          }
        : undefined,
    availability: (row.availability as unknown[]) ?? [],
    createdAt: new Date((row.created_at as string) ?? ""),
  };
}

function getAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const authRoutes = new Hono();
const admin = getAdminClient();

authRoutes.post("/login", async (c) => {
  if (!admin) {
    throw new HTTPException(503, {
      message: "Auth backend non configuré (SUPABASE_SERVICE_ROLE_KEY manquant)",
    });
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Body JSON invalide" });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: "Données invalides",
    });
  }
  const { email, phone, password } = parsed.data;

  let query = admin.from("users").select("*, password_hash");
  
  if (email) {
    query = query.eq("email", email);
  } else if (phone) {
    query = query.eq("phone", phone);
  }
  
  const { data: row, error } = await query.single();

  if (error || !row) {
    throw new HTTPException(401, { message: "Email/numéro ou mot de passe incorrect" });
  }

  const user = row as DbRow & { password_hash?: string };
  if (user.is_banned) {
    throw new HTTPException(403, { message: "Ce compte a été suspendu" });
  }

  if (!verifyPassword(password, user.password_hash ?? "")) {
    throw new HTTPException(401, { message: "Email/numéro ou mot de passe incorrect" });
  }

  const { password_hash: _unused, ...safe } = user;
  return c.json({ user: mapRowToUser(safe as DbRow) });
});

authRoutes.post("/register", async (c) => {
  if (!admin) {
    throw new HTTPException(503, {
      message: "Auth backend non configuré (SUPABASE_SERVICE_ROLE_KEY manquant)",
    });
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Body JSON invalide" });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: "Données invalides",
    });
  }
  const { id, email, username, fullName, phone, password, city, country } = parsed.data;

  if (email) {
    const { data: existingEmail } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();
    if (existingEmail) {
      throw new HTTPException(409, {
        message: "Cet email est déjà utilisé. Essayez de vous connecter.",
      });
    }
  }

  if (phone) {
    const { data: existingPhone } = await admin
      .from("users")
      .select("id")
      .eq("phone", phone)
      .single();
    if (existingPhone) {
      throw new HTTPException(409, {
        message: "Ce numéro est déjà utilisé. Essayez de vous connecter.",
      });
    }
  }

  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (existingUser) {
    throw new HTTPException(409, {
      message: "Ce nom d'utilisateur est déjà pris. Choisissez-en un autre.",
    });
  }

  const userId = id || crypto.randomUUID();
  const referralCode = `VS${userId.slice(-6).toUpperCase()}`;
  const passwordHash = hashPasswordBcrypt(password);
  
  const finalEmail = email || `${String(phone || '').replace(/\D/g, "")}_${Date.now()}@local.app`;

  const { data: inserted, error } = await admin
    .from("users")
    .insert({
      id: userId,
      email: finalEmail,
      username,
      full_name: fullName,
      phone: phone || null,
      password_hash: passwordHash,
      city: city ?? "Non spécifié",
      country: country ?? "Non spécifié",
      referral_code: referralCode,
    })
    .select(USER_PUBLIC_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HTTPException(409, {
        message: "Ce compte existe déjà. Essayez de vous connecter.",
      });
    }
    throw new HTTPException(500, { message: "Erreur création compte" });
  }

  return c.json({ user: mapRowToUser((inserted ?? {}) as DbRow) });
});
