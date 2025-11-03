-- Allow fractional years of experience to be stored without truncation
ALTER TABLE users
  ALTER COLUMN experience TYPE numeric USING experience::numeric;
