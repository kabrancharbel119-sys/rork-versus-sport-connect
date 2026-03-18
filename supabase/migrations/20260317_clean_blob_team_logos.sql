-- Remove invalid web-local team logos that cannot be loaded on mobile/native clients
UPDATE teams
SET logo = NULL
WHERE logo LIKE 'blob:%';
