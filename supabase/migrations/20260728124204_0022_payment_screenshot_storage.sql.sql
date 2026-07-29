-- Add screenshot URL column to license_payment_requests
ALTER TABLE license_payment_requests
  ADD COLUMN IF NOT EXISTS payment_screenshot_url text;

-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the storage bucket
-- Authenticated users can upload to their own folder path: user_id/filename
CREATE POLICY "payment_screenshots_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can view payment screenshots (they're public, admin needs to see them)
CREATE POLICY "payment_screenshots_public_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-screenshots');

-- Users can delete their own screenshots
CREATE POLICY "payment_screenshots_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );