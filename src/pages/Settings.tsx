import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Smartphone, IndianRupee, Image as ImageIcon, CheckCircle2, Loader2, Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, Input, Spinner } from '@/components/ui/primitives';

export default function SettingsPage() {
  const { profile } = useAuth();
  const { settings, loading, refresh } = useSettings();
  const toast = useToast();

  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [licensePrice, setLicensePrice] = useState('');
  const [hubAddPrice, setHubAddPrice] = useState('');
  const [adsenseClient, setAdsenseClient] = useState('');
  const [adsenseEnabled, setAdsenseEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setUpiId(settings.upi_id);
      setPayeeName(settings.payee_name);
      setQrImageUrl(settings.qr_image_url || '');
      setLicensePrice(String(settings.license_price));
      setHubAddPrice(String(settings.hub_add_price));
      setAdsenseClient(settings.adsense_client || '');
      setAdsenseEnabled(settings.adsense_enabled);
    }
  }, [loading, settings]);

  const handleSave = async () => {
    if (!upiId.trim()) {
      toast.error('UPI ID is required');
      return;
    }
    if (!payeeName.trim()) {
      toast.error('Payee name is required');
      return;
    }
    const lp = parseInt(licensePrice) || 0;
    const hp = parseInt(hubAddPrice) || 0;
    if (lp <= 0 || hp <= 0) {
      toast.error('Prices must be greater than zero');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({
        upi_id: upiId.trim(),
        payee_name: payeeName.trim(),
        qr_image_url: qrImageUrl.trim() || null,
        license_price: lp,
        hub_add_price: hp,
        adsense_client: adsenseClient.trim() || null,
        adsense_enabled: adsenseEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Failed to save settings');
      return;
    }
    toast.success('Payment settings updated successfully');
    refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (profile?.role !== 'super_admin') {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <p className="text-sm text-neutral-500">Only super admins can access this page.</p>
      </div>
    );
  }

  const qrSrc = qrImageUrl.trim() || settings.qr_image_url || '/ChatGPT_Image_Jul_28,_2026,_11_30_59_PM.png';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2.5 text-white shadow-glow">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Payment Settings</h1>
          <p className="text-sm text-neutral-500">Update UPI details and license prices shown to your customers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <Smartphone className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">UPI Payment Details</h2>
            </div>
            <div className="space-y-4">
              <Input
                label="UPI ID / VPA"
                name="upiId"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="example@upi"
                hint="This is the UPI ID customers will send payments to."
              />
              <Input
                label="Payee Name"
                name="payeeName"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Your Business Name"
                hint="Shown on the UPI payment screen."
              />
              <Input
                label="QR Code Image URL"
                name="qrImageUrl"
                value={qrImageUrl}
                onChange={(e) => setQrImageUrl(e.target.value)}
                placeholder="/path/to/qr.png or https://..."
                hint="URL of the QR code image. Leave empty to keep existing."
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <IndianRupee className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">License Pricing</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="License Price (INR)"
                name="licensePrice"
                type="number"
                value={licensePrice}
                onChange={(e) => setLicensePrice(e.target.value)}
                placeholder="999"
                hint="One-time price for a license."
              />
              <Input
                label="Add-Hub Price (INR)"
                name="hubAddPrice"
                type="number"
                value={hubAddPrice}
                onChange={(e) => setHubAddPrice(e.target.value)}
                placeholder="499"
                hint="Price to add one extra hub."
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <Megaphone className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">Google AdSense</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={adsenseEnabled}
                  onChange={(e) => setAdsenseEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-600/30"
                />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Enable Google AdSense ads</span>
              </label>
              <Input
                label="AdSense Publisher ID (ca-pub-XXXX)"
                name="adsenseClient"
                value={adsenseClient}
                onChange={(e) => setAdsenseClient(e.target.value)}
                placeholder="ca-pub-1234567890123456"
                hint="Find this in your AdSense account. Leave empty to disable all ads."
              />
              {!adsenseEnabled && (
                <p className="text-xs text-neutral-400">Ads are currently hidden on all pages. Enable and enter your publisher ID to show them.</p>
              )}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving} icon={saving ? undefined : <Save className="h-4 w-4" />}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <ImageIcon className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-bold text-neutral-800 dark:text-neutral-200">Live Preview</h2>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 text-center">
              <img src={qrSrc} alt="UPI QR Code" className="h-36 w-36 rounded-lg mx-auto object-contain" />
              <p className="mt-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200">{payeeName || 'Payee Name'}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{upiId || 'upi-id@bank'}</p>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
                This is what customers will see
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2">How it works</h3>
            <ul className="space-y-2 text-xs text-neutral-500 leading-relaxed">
              <li className="flex gap-2"><span className="text-brand-600 font-bold">1.</span> Update UPI details and prices here.</li>
              <li className="flex gap-2"><span className="text-brand-600 font-bold">2.</span> Changes apply instantly to all customers.</li>
              <li className="flex gap-2"><span className="text-brand-600 font-bold">3.</span> No redeployment needed — Vercel and cPanel pick it up automatically.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
