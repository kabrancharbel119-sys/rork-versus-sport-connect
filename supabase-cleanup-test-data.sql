-- =============================================================================
-- NETTOYAGE DES DONNÉES DE TEST – Équipes et matchs
-- =============================================================================
-- À exécuter dans le SQL Editor de ton projet Supabase (Dashboard > SQL Editor).
--
-- Ce script supprime les équipes et matchs créés en phase de test pour repartir
-- sur des données propres. Les équipes/matchs créés par de vrais utilisateurs
-- après cette date resteront si tu utilises l’option par date.
--
-- OPTION A – Tout supprimer (équipes + matchs de test)
-- Décommente le bloc "OPTION A" ci-dessous et exécute.
--
-- Après exécution : dans l'app, faire "tirer pour actualiser" sur Équipes et Matchs
-- pour vider le cache local et recharger depuis Supabase.
--
-- OPTION B – Supprimer seulement ce qui a été créé avant une certaine date
-- Commente les 2 DELETE ci-dessus et décommente le bloc "OPTION B" avec ta date.
-- Exemple : tout ce qui a été créé avant le 1er février 2025.
-- =============================================================================

-- Désactiver temporairement les contraintes de clé étrangère pour matches
-- (les matchs référencent des teams ; on peut supprimer les matchs d’abord)

-- ----- OPTION A : tout supprimer (exécute les 2 lignes ci-dessous) -----
DELETE FROM matches;
DELETE FROM teams;

-- ----- OPTION B : supprimer seulement les données avant une date (ex. 2025-02-01) -----
-- DELETE FROM matches WHERE created_at < '2025-02-01T00:00:00Z';
-- DELETE FROM teams WHERE created_at < '2025-02-01T00:00:00Z';

-- ----- OPTION C : supprimer par noms (ex. équipes de test nommées "Test" ou "Équipe test") -----
-- DELETE FROM matches WHERE created_by IN (SELECT id FROM users WHERE username ILIKE '%test%');
-- DELETE FROM teams WHERE name ILIKE '%test%' OR name ILIKE '%équipe test%';

-- =============================================================================
-- Recommandation : utilise OPTION A pour un reset complet, puis laisse les
-- utilisateurs recréer leurs équipes et matchs. Vérifie aussi que les politiques
-- RLS sur `teams` et `matches` autorisent bien SELECT pour tout le monde
-- (voir supabase-schema.sql : "Teams are viewable by everyone", etc.).
-- =============================================================================
