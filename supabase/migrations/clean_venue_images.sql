-- ============================================================
-- CLEAN VENUE IMAGES: Remove local file URLs, keep only public URLs
-- ============================================================

-- Remove any local file:// URLs from venue images arrays
UPDATE venues
SET images = (
  SELECT ARRAY_AGG(url)
  FROM UNNEST(images) AS url
  WHERE url LIKE 'http://%' OR url LIKE 'https://%'
)
WHERE EXISTS (
  SELECT 1 FROM UNNEST(images) AS url
  WHERE url LIKE 'file://%' OR url LIKE 'content://%' OR url LIKE 'ph://%' OR url LIKE 'blob:%'
);

-- Log the cleanup
SELECT 
  COUNT(*) as total_venues,
  COUNT(CASE WHEN array_length(images, 1) > 0 THEN 1 END) as venues_with_images,
  SUM(COALESCE(array_length(images, 1), 0)) as total_images
FROM venues;
