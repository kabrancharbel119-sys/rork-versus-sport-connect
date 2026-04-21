-- Vérifier le nom EXACT des buckets (sensible à la casse et aux espaces)
SELECT id, name, public, length(name) as name_length
FROM storage.buckets
ORDER BY created_at;
