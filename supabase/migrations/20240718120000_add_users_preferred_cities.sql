ALTER TABLE users
  ADD COLUMN preferred_cities text[] DEFAULT '{}'::text[];
