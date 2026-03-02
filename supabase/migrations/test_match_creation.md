# TEST DE CRÉATION DE MATCH HORS TOURNOI

## Analyse du processus complet

### 1. DONNÉES FOURNIES PAR L'API (matches.ts)

```typescript
const insertPayload = {
  title: "Football 5v5 - Terrain de Cocody",  // ✅ AJOUTÉ
  sport: "football",                           // ✅
  format: "5v5",                              // ✅
  type: "friendly",                           // ✅
  status: "open",                             // ✅
  venue_id: "uuid-du-terrain",                // ✅
  venue_data: {                               // ✅ JSONB
    id: "uuid",
    name: "Terrain de Cocody",
    address: "Rue des Sports",
    city: "Abidjan"
  },
  date_time: "2026-03-05T15:00:00Z",         // ✅
  duration: 90,                               // ✅
  level: "intermediate",                      // ✅
  ambiance: "casual",                         // ✅
  max_players: 10,                            // ✅
  registered_players: [],                     // ✅ JSONB (vide au départ)
  created_by: "user-uuid",                    // ✅
  home_team_id: null,                         // ✅
  away_team_id: null,                         // ✅
  entry_fee: 0,                               // ✅
  prize: 0,                                   // ✅
  needs_players: true,                        // ✅
  location_lat: 5.3599,                       // ✅
  location_lng: -4.0083,                      // ✅
  // tournament_id: non fourni pour match hors tournoi
  // round_label: non fourni pour match hors tournoi
}
```

### 2. COLONNES REQUISES PAR SUPABASE (types/supabase.ts)

#### Colonnes OBLIGATOIRES (Insert):
- ✅ `sport` - string
- ✅ `format` - string
- ✅ `type` - string
- ✅ `date_time` - string
- ✅ `level` - string
- ✅ `ambiance` - string

#### Colonnes OPTIONNELLES avec defaults:
- ✅ `id` - UUID auto-généré
- ✅ `status` - default: 'open'
- ✅ `home_team_id` - nullable
- ✅ `away_team_id` - nullable
- ✅ `venue_id` - nullable
- ✅ `venue_data` - Json nullable
- ✅ `duration` - default: 90
- ✅ `max_players` - default: 22
- ✅ `registered_players` - Json default: []
- ✅ `score_home` - nullable
- ✅ `score_away` - nullable
- ✅ `mvp_id` - nullable
- ✅ `created_by` - nullable
- ✅ `entry_fee` - default: 0
- ✅ `prize` - default: 0
- ✅ `needs_players` - default: true
- ✅ `location_lat` - nullable
- ✅ `location_lng` - nullable
- ✅ `player_stats` - Json default: []
- ✅ `created_at` - auto timestamp

#### Colonnes MANQUANTES dans le schéma TypeScript:
- ⚠️ `title` - NON PRÉSENTE dans types/supabase.ts mais EXISTE dans la DB

### 3. PROBLÈMES DÉTECTÉS

#### ❌ PROBLÈME 1: Colonne `title` manquante dans le schéma TypeScript
- La DB a une colonne `title` avec contrainte NOT NULL
- Le schéma TypeScript ne la déclare pas
- L'API la fournit maintenant, mais le type n'est pas à jour

#### ❌ PROBLÈME 2: Incohérence des types
- `registered_players` dans API: `[]` (array vide)
- `registered_players` dans DB: JSONB
- Besoin de conversion automatique par Supabase

#### ❌ PROBLÈME 3: Colonnes tournament manquantes
- `tournament_id` et `round_label` ne sont PAS dans le schéma TypeScript
- Mais elles sont utilisées dans l'API (MatchRow interface)

### 4. CORRECTIONS NÉCESSAIRES

#### A. Script SQL (add_missing_matches_columns.sql)
✅ Rend `title` nullable avec default 'Match'
✅ Vérifie et corrige `venue_data` en JSONB
✅ Vérifie et corrige `registered_players` en JSONB
✅ Vérifie et corrige `player_stats` en JSONB
✅ Ajoute `needs_players` si manquant
✅ Ajoute `tournament_id` si manquant
✅ Ajoute `round_label` si manquant
✅ Ajoute `entry_fee` si manquant
✅ Ajoute `prize` si manquant
✅ Ajoute `location_lat` et `location_lng` si manquants

#### B. API (lib/api/matches.ts)
✅ Génère automatiquement un `title` par défaut
✅ Fournit toutes les colonnes requises

#### C. Types TypeScript (types/supabase.ts)
⚠️ BESOIN DE MISE À JOUR pour inclure:
- `title?: string` dans Insert
- `title: string` dans Row
- `tournament_id?: string | null` dans Insert/Update
- `round_label?: string | null` dans Insert/Update

### 5. SCÉNARIO DE TEST

```typescript
// Données envoyées par l'utilisateur
const matchData = {
  sport: 'football',
  format: '5v5',
  type: 'friendly',
  venueId: 'existing-venue-uuid',
  dateTime: new Date('2026-03-05T15:00:00'),
  duration: 90,
  level: 'intermediate',
  ambiance: 'casual',
  maxPlayers: 10,
  needsPlayers: true,
  location: {
    latitude: 5.3599,
    longitude: -4.0083
  }
}

// Résultat attendu après transformation API
INSERT INTO matches (
  title,              -- "Football 5v5 - Terrain de Cocody"
  sport,              -- "football"
  format,             -- "5v5"
  type,               -- "friendly"
  status,             -- "open"
  venue_id,           -- UUID du terrain
  venue_data,         -- {"id": "...", "name": "...", ...}
  date_time,          -- "2026-03-05T15:00:00Z"
  duration,           -- 90
  level,              -- "intermediate"
  ambiance,           -- "casual"
  max_players,        -- 10
  registered_players, -- []
  created_by,         -- UUID de l'utilisateur
  home_team_id,       -- null
  away_team_id,       -- null
  entry_fee,          -- 0
  prize,              -- 0
  needs_players,      -- true
  location_lat,       -- 5.3599
  location_lng        -- -4.0083
) VALUES (...)
```

### 6. POINTS DE VÉRIFICATION

✅ Le terrain existe dans la table `venues`
✅ L'utilisateur existe dans la table `users`
✅ Toutes les colonnes obligatoires sont fournies
✅ Les types de données correspondent
✅ Les contraintes NOT NULL sont respectées
✅ Les clés étrangères sont valides

### 7. CONCLUSION

**STATUT**: ✅ Le processus devrait fonctionner APRÈS exécution du script SQL

**ACTIONS REQUISES**:
1. ✅ Exécuter `complete_venues_setup.sql` pour créer les terrains
2. ✅ Exécuter `add_missing_matches_columns.sql` pour corriger la table matches
3. ⚠️ Optionnel: Mettre à jour `types/supabase.ts` pour refléter les vraies colonnes

**ERREURS POSSIBLES RESTANTES**:
- Si le terrain n'existe pas → "Terrain non trouvé"
- Si l'utilisateur n'existe pas → Erreur de clé étrangère
- Si RLS (Row Level Security) bloque l'insertion → Erreur de permission
