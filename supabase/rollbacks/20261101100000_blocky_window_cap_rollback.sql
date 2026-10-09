-- Removes Blocky's 3-hour limit setting. Deploy the functions from before it first: they stop reading the column.
ALTER TABLE public.blocky_settings DROP COLUMN IF EXISTS window_cap_usd;
