-- Ajouter la colonne pour stocker le taux de commission Uber contractuel (en %)
ALTER TABLE public.restaurants 
ADD COLUMN uber_commission_rate numeric DEFAULT 30;