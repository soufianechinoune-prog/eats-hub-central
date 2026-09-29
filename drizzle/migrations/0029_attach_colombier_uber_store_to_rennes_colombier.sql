-- Rattache la 2e boutique Uber Eats (Colombier) à la fiche unique TASTY CROUSTY RENNES COLOMBIER
UPDATE public.restaurant_uber_ids
SET restaurant_id = 'a7c4d67f-cbba-417b-ad4c-97e7d46a7287',
    label = 'boutique 2 (Colombier)'
WHERE uber_store_id = '37b27fc0-bb7e-5c2e-abd0-48dd5471d2c4';
