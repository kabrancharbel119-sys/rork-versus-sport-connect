-- ============================================
-- VENUE REVIEWS SYSTEM (notes + commentaires)
-- ============================================

-- 1) Table des avis
CREATE TABLE IF NOT EXISTS venue_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_reviews_user_venue_unique UNIQUE (venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_venue_id ON venue_reviews(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_reviews_user_id ON venue_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_reviews_created_at ON venue_reviews(created_at DESC);

-- 2) Trigger updated_at
CREATE OR REPLACE FUNCTION set_venue_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_venue_reviews_updated_at ON venue_reviews;
CREATE TRIGGER trg_set_venue_reviews_updated_at
BEFORE UPDATE ON venue_reviews
FOR EACH ROW
EXECUTE FUNCTION set_venue_reviews_updated_at();

-- 3) Sync note moyenne dans venues.rating
CREATE OR REPLACE FUNCTION refresh_venue_rating_from_reviews(target_venue_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  avg_rating NUMERIC;
BEGIN
  SELECT AVG(vr.rating)::NUMERIC(3,2)
  INTO avg_rating
  FROM venue_reviews vr
  WHERE vr.venue_id = target_venue_id;

  UPDATE venues
  SET rating = COALESCE(avg_rating, 0)
  WHERE id = target_venue_id;
END;
$$;

CREATE OR REPLACE FUNCTION trg_refresh_venue_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM refresh_venue_rating_from_reviews(OLD.venue_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_venue_rating_from_reviews(NEW.venue_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_venue_rating_insert ON venue_reviews;
DROP TRIGGER IF EXISTS trg_refresh_venue_rating_update ON venue_reviews;
DROP TRIGGER IF EXISTS trg_refresh_venue_rating_delete ON venue_reviews;

CREATE TRIGGER trg_refresh_venue_rating_insert
AFTER INSERT ON venue_reviews
FOR EACH ROW
EXECUTE FUNCTION trg_refresh_venue_rating();

CREATE TRIGGER trg_refresh_venue_rating_update
AFTER UPDATE OF rating ON venue_reviews
FOR EACH ROW
EXECUTE FUNCTION trg_refresh_venue_rating();

CREATE TRIGGER trg_refresh_venue_rating_delete
AFTER DELETE ON venue_reviews
FOR EACH ROW
EXECUTE FUNCTION trg_refresh_venue_rating();

-- 4) Backfill initial des notes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM venue_reviews LIMIT 1) THEN
    UPDATE venues v
    SET rating = COALESCE(src.avg_rating, 0)
    FROM (
      SELECT venue_id, AVG(rating)::NUMERIC(3,2) AS avg_rating
      FROM venue_reviews
      GROUP BY venue_id
    ) src
    WHERE v.id = src.venue_id;
  END IF;
END $$;

-- 5) RLS
ALTER TABLE venue_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venue reviews are viewable by authenticated users" ON venue_reviews;
CREATE POLICY "Venue reviews are viewable by authenticated users"
ON venue_reviews
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert own venue review" ON venue_reviews;
CREATE POLICY "Users can insert own venue review"
ON venue_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.venue_id = venue_id
      AND b.user_id = auth.uid()
      AND b.status IN ('confirmed', 'completed')
  )
);

DROP POLICY IF EXISTS "Users can update own venue review" ON venue_reviews;
CREATE POLICY "Users can update own venue review"
ON venue_reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own venue review" ON venue_reviews;
CREATE POLICY "Users can delete own venue review"
ON venue_reviews
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
