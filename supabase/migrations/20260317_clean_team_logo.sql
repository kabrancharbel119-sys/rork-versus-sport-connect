-- Clean invalid team logo URL for FC TOU MODI
UPDATE teams 
SET logo = NULL 
WHERE id = '5f14f3fb-8c87-4657-8e69-f44ef297de89' AND logo LIKE '%team-logos%';
