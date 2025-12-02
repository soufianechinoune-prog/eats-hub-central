-- Add columns to customer_reviews table
ALTER TABLE customer_reviews
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_type TEXT,
ADD COLUMN IF NOT EXISTS order_total NUMERIC,
ADD COLUMN IF NOT EXISTS response_status TEXT,
ADD COLUMN IF NOT EXISTS response_text TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'uber_eats';

-- Add columns to menu_item_reviews table
ALTER TABLE menu_item_reviews
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'uber_eats';

-- Generate realistic fake data for customer_reviews (6 months)
DO $$
DECLARE
  restaurant RECORD;
  review_date DATE;
  month_offset INTEGER;
  reviews_per_month INTEGER;
  i INTEGER;
  rating_value NUMERIC;
  has_comment BOOLEAN;
  customer_names TEXT[] := ARRAY['Sophie Martin', 'Thomas Dubois', 'Marie Lefebvre', 'Alexandre Bernard', 'Julie Petit', 'Nicolas Roux', 'Camille Vincent', 'Pierre Fournier', 'Emma Moreau', 'Lucas Simon'];
  positive_comments TEXT[] := ARRAY[
    'Excellent repas, livraison rapide !',
    'Toujours aussi bon, je recommande vivement.',
    'Plats délicieux et bien chauds à l''arrivée.',
    'Parfait comme d''habitude, merci !',
    'Très satisfait de la qualité et du service.',
    'Super expérience, tout était parfait.',
    'Livraison rapide et plats savoureux.'
  ];
  neutral_comments TEXT[] := ARRAY[
    'Correct, sans plus.',
    'Plats bons mais livraison un peu longue.',
    'Pas mal, mais j''ai connu mieux.',
    'Convenable pour le prix.'
  ];
  negative_comments TEXT[] := ARRAY[
    'Livraison très en retard, plats froids.',
    'Qualité décevante par rapport à d''habitude.',
    'Portions trop petites pour le prix.',
    'Erreur dans la commande, dommage.',
    'Plats arrivés froids et renversés.'
  ];
  positive_tags TEXT[] := ARRAY['Savoureux', 'Chaud', 'Généreux', 'Rapide', 'Bien emballé'];
  negative_tags TEXT[] := ARRAY['Froid ou fondu', 'En retard', 'Portions petites', 'Erreur de commande', 'Mal emballé'];
BEGIN
  -- Loop through restaurants
  FOR restaurant IN (SELECT id FROM restaurants LIMIT 20)
  LOOP
    -- Generate reviews for last 6 months
    FOR month_offset IN 0..5
    LOOP
      reviews_per_month := 8 + floor(random() * 7)::INTEGER; -- 8-15 reviews per month
      
      FOR i IN 1..reviews_per_month
      LOOP
        review_date := CURRENT_DATE - (month_offset * 30 + floor(random() * 30)::INTEGER);
        
        -- Generate rating with realistic distribution (mostly 4-5 stars)
        rating_value := CASE 
          WHEN random() < 0.60 THEN 5.0
          WHEN random() < 0.85 THEN 4.0
          WHEN random() < 0.95 THEN 3.0
          ELSE 2.0 + floor(random() * 2)
        END;
        
        has_comment := random() < 0.4; -- 40% have comments
        
        INSERT INTO customer_reviews (
          restaurant_id,
          overall_rating,
          food_rating,
          delivery_rating,
          review_date,
          customer_name,
          customer_type,
          customer_comment,
          order_total,
          response_status,
          tags,
          platform
        ) VALUES (
          restaurant.id,
          rating_value,
          rating_value + (random() * 0.5 - 0.25), -- slight variation
          rating_value + (random() * 0.5 - 0.25),
          review_date,
          customer_names[1 + floor(random() * array_length(customer_names, 1))],
          CASE 
            WHEN random() < 0.3 THEN 'Nouveau client'
            ELSE (1 + floor(random() * 50))::TEXT || ' commandes'
          END,
          CASE 
            WHEN NOT has_comment THEN NULL
            WHEN rating_value >= 4 THEN positive_comments[1 + floor(random() * array_length(positive_comments, 1))]
            WHEN rating_value = 3 THEN neutral_comments[1 + floor(random() * array_length(neutral_comments, 1))]
            ELSE negative_comments[1 + floor(random() * array_length(negative_comments, 1))]
          END,
          15.0 + random() * 35.0, -- order total between 15-50€
          CASE 
            WHEN rating_value <= 3 AND random() < 0.3 THEN 'pending'
            WHEN rating_value <= 3 AND random() < 0.6 THEN 'replied'
            ELSE NULL
          END,
          CASE 
            WHEN rating_value >= 4 THEN ARRAY[positive_tags[1 + floor(random() * array_length(positive_tags, 1))]]
            WHEN rating_value <= 3 THEN ARRAY[negative_tags[1 + floor(random() * array_length(negative_tags, 1))]]
            ELSE NULL
          END,
          CASE WHEN random() < 0.7 THEN 'uber_eats' ELSE 'deliveroo' END
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Generate realistic fake data for menu_item_reviews (6 months)
DO $$
DECLARE
  restaurant RECORD;
  menu_item RECORD;
  review_date DATE;
  month_offset INTEGER;
  reviews_per_item INTEGER;
  i INTEGER;
  rating_value NUMERIC;
  positive_tags TEXT[] := ARRAY['Savoureux', 'Généreux', 'Bien épicé', 'Frais', 'Parfait'];
  negative_tags TEXT[] := ARRAY['Froid', 'Trop salé', 'Manque de sauce', 'Trop cuit', 'Fade'];
BEGIN
  -- Loop through restaurants
  FOR restaurant IN (SELECT id FROM restaurants LIMIT 20)
  LOOP
    -- Get some menu items
    FOR menu_item IN (SELECT id, name FROM menu_items WHERE is_active = true LIMIT 15)
    LOOP
      -- Generate 0-3 reviews per item over 6 months
      reviews_per_item := floor(random() * 4)::INTEGER;
      
      FOR i IN 1..reviews_per_item
      LOOP
        month_offset := floor(random() * 6)::INTEGER;
        review_date := CURRENT_DATE - (month_offset * 30 + floor(random() * 30)::INTEGER);
        
        -- Generate rating with realistic distribution
        rating_value := CASE 
          WHEN random() < 0.65 THEN 5.0
          WHEN random() < 0.85 THEN 4.0
          ELSE 3.0
        END;
        
        INSERT INTO menu_item_reviews (
          restaurant_id,
          item_id,
          item_title,
          rating,
          thumb_up,
          thumb_down,
          comment,
          review_date,
          tags,
          platform
        ) VALUES (
          restaurant.id,
          menu_item.id::TEXT,
          menu_item.name,
          rating_value,
          CASE WHEN rating_value >= 4 THEN 1 ELSE 0 END,
          CASE WHEN rating_value < 4 THEN 1 ELSE 0 END,
          CASE 
            WHEN random() < 0.3 THEN 'Très bon plat !'
            WHEN random() < 0.5 THEN 'Délicieux comme toujours'
            ELSE NULL
          END,
          review_date,
          CASE 
            WHEN rating_value >= 4 THEN ARRAY[positive_tags[1 + floor(random() * array_length(positive_tags, 1))]]
            ELSE ARRAY[negative_tags[1 + floor(random() * array_length(negative_tags, 1))]]
          END,
          CASE WHEN random() < 0.7 THEN 'uber_eats' ELSE 'deliveroo' END
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;