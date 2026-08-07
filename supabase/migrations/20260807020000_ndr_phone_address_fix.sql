-- Migration: Add consignee_phone and delivery_address to ndr_shipments
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS consignee_phone TEXT;
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Indexes for fast phone and address lookup
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_phone ON public.ndr_shipments(consignee_phone);
