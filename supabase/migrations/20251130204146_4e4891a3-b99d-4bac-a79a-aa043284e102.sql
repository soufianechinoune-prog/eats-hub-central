-- Add restaurant_ids array column for multi-restaurant actions
ALTER TABLE restaurant_actions 
ADD COLUMN restaurant_ids uuid[] DEFAULT '{}';