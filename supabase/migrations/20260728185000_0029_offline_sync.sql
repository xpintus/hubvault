/*
# Offline Sync Schema Updates
*/

-- Add client_id and created_offline to operational tables
ALTER TABLE public.collection_entries
  ADD COLUMN IF NOT EXISTS client_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS created_offline boolean DEFAULT false;

ALTER TABLE public.collectors
  ADD COLUMN IF NOT EXISTS client_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS created_offline boolean DEFAULT false;

ALTER TABLE public.dues
  ADD COLUMN IF NOT EXISTS client_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS created_offline boolean DEFAULT false;

ALTER TABLE public.recoveries
  ADD COLUMN IF NOT EXISTS client_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS created_offline boolean DEFAULT false;

ALTER TABLE public.denominations
  ADD COLUMN IF NOT EXISTS client_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS created_offline boolean DEFAULT false;

-- Add updated_at to tables missing it
ALTER TABLE public.collectors
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.denominations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.recoveries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create or update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_collectors_updated_at ON public.collectors;
CREATE TRIGGER update_collectors_updated_at
BEFORE UPDATE ON public.collectors
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_denominations_updated_at ON public.denominations;
CREATE TRIGGER update_denominations_updated_at
BEFORE UPDATE ON public.denominations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recoveries_updated_at ON public.recoveries;
CREATE TRIGGER update_recoveries_updated_at
BEFORE UPDATE ON public.recoveries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
