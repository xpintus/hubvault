import { useState, useEffect, useCallback } from 'react';
import {
  Gift, Smartphone, CheckCircle2, Clock, AlertTriangle, Copy,
  QrCode, Loader2, ArrowRight, KeyRound, Sparkles, Upload, X, Image as ImageIcon,
} from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { Button, Input } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useSettings } from '@/lib/settings';
import { Profile } from '@/types';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

interface RequestLicenseModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onLicenseObtained: (licenseCode: string) => void;
  mode?: 'license' | 'hub_add';
  onHubCreditGranted?: () => void;
}

type Tab = 'upi' | 'giftcard';
type UpiStage = 'form' | 'submitted' | 'approved' | 'rejected';
type GiftStage = 'form' | 'success';

interface PaymentRequest {
  id: string;
  status: 'pending' | 'verified' | 'rejected';
  transaction_id: string;
  license_code: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  verified_at: string | null;
  request_type?: 'license' | 'hub_add';
  payment_screenshot_url?: string | null;
}

export default function RequestLicenseModal({ open, onClose, profile, onLicenseObtained, mode = 'license', onHubCreditGranted }: RequestLicenseModalProps) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('upi');
  const [loading, setLoading] = useState(false);
  const [existingRequests, setExistingRequests] = useState<PaymentRequest[]>([]);

  // UPI form state
  const [upiStage, setUpiStage] = useState<UpiStage>('form');
  const [txnId, setTxnId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerUpi, setPayerUpi] = useState('');
  const [amount, setAmount] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Gift card state
  const [giftStage, setGiftStage] = useState<GiftStage>('form');
  const [cardCode, setCardCode] = useState('');
  const [revealedLicense, setRevealedLicense] = useState('');

  // UPI config (from database — editable by admin in Settings)
  const { settings } = useSettings();
  const UPI_ID = settings.upi_id;
  const UPI_NAME = settings.payee_name;
  const priceNum = mode === 'hub_add' ? settings.hub_add_price : settings.license_price;
  const LICENSE_PRICE = `₹${priceNum}`;
  const LICENSE_PRICE_NUM = String(priceNum);

  const callApi = async (action: string, body?: Record<string, unknown>) => {
    let token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token;
    }
    if (!token) throw new Error('Your session has expired. Please log in again.');
    const response = await fetch(`${FUNCTION_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.access_token) {
          const retry = await fetch(`${FUNCTION_URL}?action=${action}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshed.session.access_token}`,
            },
            body: body ? JSON.stringify(body) : undefined,
          });
          const retryData = await retry.json();
          if (!retry.ok) throw new Error(retryData.error || `Request failed (${retry.status})`);
          return retryData;
        }
      }
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  };

  const loadExistingRequests = useCallback(async () => {
    try {
      const data = await callApi('check-payment-status');
      const all = data.requests || [];
      const filtered = all.filter((r: PaymentRequest) =>
        (r.request_type || 'license') === mode
      );
      setExistingRequests(filtered);
      if (filtered.length > 0) {
        const latest = filtered[0];
        if (latest.status === 'pending') setUpiStage('submitted');
        else if (latest.status === 'verified' && latest.license_code) {
          setUpiStage('approved');
        } else if (latest.status === 'verified' && mode === 'hub_add') {
          // Old verified hub_add payments don't mean the credit is still available.
          // Show the fresh payment form so user can submit a new payment if needed.
          setUpiStage('form');
        } else if (latest.status === 'rejected') {
          setUpiStage('rejected');
        }
      }
    } catch {
      // Ignore — user might not have requests yet
    }
  }, [mode]);

  useEffect(() => {
    if (open) {
      setTab('upi');
      setUpiStage('form');
      setGiftStage('form');
      setCardCode('');
      setRevealedLicense('');
      setTxnId('');
      setPayerName(profile.name || '');
      setPayerUpi('');
      setAmount('');
      setScreenshotFile(null);
      setScreenshotPreview(null);
      loadExistingRequests();
    }
  }, [open, profile.name, loadExistingRequests]);

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotFile) return null;
    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');
      const ext = screenshotFile.name.split('.').pop() || 'png';
      const fileName = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('payment-screenshots')
        .upload(fileName, screenshotFile, { contentType: screenshotFile.type, upsert: false });
      if (error) throw new Error(error.message);
      const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(fileName);
      return urlData.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleUpiSubmit = async () => {
    if (!txnId.trim()) {
      toast.error('Please enter the transaction ID / UTR number');
      return;
    }
    setLoading(true);
    try {
      let screenshotUrl: string | null = null;
      if (screenshotFile) {
        screenshotUrl = await uploadScreenshot();
      }
      const resp = await callApi('request-license-upi', {
        transaction_id: txnId.trim(),
        payment_method: 'upi',
        payer_name: payerName.trim() || undefined,
        payer_upi: payerUpi.trim() || undefined,
        amount: amount ? parseFloat(amount) : 0,
        request_type: mode,
        payment_screenshot_url: screenshotUrl || undefined,
      });
      setUpiStage('submitted');
      toast.success(resp.message || 'Payment request submitted! Admin will verify shortly.');
      loadExistingRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleGiftCardRedeem = async () => {
    if (!cardCode.trim()) {
      toast.error('Please enter your gift card code');
      return;
    }
    setLoading(true);
    try {
      const data = await callApi('redeem-gift-card', {
        card_code: cardCode.trim(),
        mode,
      });
      if (mode === 'hub_add') {
        setGiftStage('success');
        toast.success('Gift card redeemed! 1 hub credit added to your account.');
        onHubCreditGranted?.();
      } else {
        setRevealedLicense(data.license_code);
        setGiftStage('success');
        toast.success('Gift card redeemed! Your license code is ready.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to redeem gift card');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${LICENSE_PRICE_NUM}&cu=INR`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'hub_add' ? 'Add Hub License' : 'Get Your License Key'}
      subtitle={mode === 'hub_add'
        ? `Pay ₹${settings.hub_add_price} via UPI to add one more hub to your account`
        : `Pay ₹${settings.license_price} via UPI or redeem a gift card to get your activation code`}
      size="md"
      closable
      footer={
        giftStage === 'success' && mode === 'hub_add' ? (
          <Button onClick={() => { onHubCreditGranted?.(); }}>Done</Button>
        ) : giftStage === 'success' ? (
          <>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => onLicenseObtained(revealedLicense)} icon={<KeyRound className="h-4 w-4" />}>
              Activate Now
            </Button>
          </>
        ) : upiStage === 'approved' && mode === 'hub_add' ? (
          <Button onClick={() => { onHubCreditGranted?.(); }}>Done</Button>
        ) : upiStage === 'approved' && existingRequests[0]?.license_code ? (
          <>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => onLicenseObtained(existingRequests[0].license_code!)} icon={<KeyRound className="h-4 w-4" />}>
              Activate Now
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        )
      }
    >
      {/* Tabs */}
      {(upiStage === 'form' || upiStage === 'submitted' || upiStage === 'rejected') && giftStage === 'form' && (
        <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl mb-5">
          <button
            onClick={() => setTab('upi')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              tab === 'upi'
                ? 'bg-white dark:bg-neutral-800 text-brand-600 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            UPI Payment
          </button>
          <button
            onClick={() => setTab('giftcard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              tab === 'giftcard'
                ? 'bg-white dark:bg-neutral-800 text-brand-600 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Gift className="h-4 w-4" />
            Gift Card
          </button>
        </div>
      )}

      {/* UPI TAB */}
      {tab === 'upi' && (
        <div className="space-y-4">
          {upiStage === 'form' && (
            <>
              {/* Payment info */}
              <div className="rounded-2xl border border-brand-200 dark:border-brand-800/50 bg-brand-50 dark:bg-brand-900/10 p-5">
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                  <div className="rounded-xl bg-white p-2 shadow-sm shrink-0">
                    <img src={settings.qr_image_url || '/ChatGPT_Image_Jul_28,_2026,_11_30_59_PM.png'} alt="UPI QR Code" className="h-36 w-36 rounded-lg" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Pay via UPI</p>
                    <p className="text-xs text-neutral-500">Scan the QR code or send payment to the UPI ID below</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 rounded-lg px-3 py-2.5">
                    <span className="text-xs text-neutral-500">UPI ID</span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-semibold text-neutral-900 dark:text-neutral-100">{UPI_ID}</code>
                      <button onClick={() => copyText(UPI_ID, 'UPI ID')} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition">
                        <Copy className="h-3.5 w-3.5 text-neutral-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 rounded-lg px-3 py-2.5">
                    <span className="text-xs text-neutral-500">Amount</span>
                    <span className="text-sm font-bold text-brand-600">{LICENSE_PRICE}</span>
                  </div>
                </div>

                <a
                  href={upiLink}
                  className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white py-2.5 text-sm font-semibold transition active:scale-95"
                >
                  <Smartphone className="h-4 w-4" />
                  Open UPI App
                </a>
              </div>

              {/* Transaction submission form */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">After payment, enter your transaction details</p>
                <Input
                  label="Transaction ID / UTR Number *"
                  name="txn_id"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  placeholder="e.g. 456789123456"
                  error={undefined}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Your Name"
                    name="payer_name"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Full name"
                    error={undefined}
                  />
                  <Input
                    label="Your UPI ID"
                    name="payer_upi"
                    value={payerUpi}
                    onChange={(e) => setPayerUpi(e.target.value)}
                    placeholder="name@upi"
                    error={undefined}
                  />
                </div>
                <Input
                  label="Amount Paid"
                  name="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={LICENSE_PRICE_NUM}
                  error={undefined}
                />

                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    After submitting, admin will verify your payment and issue your license code. This usually takes a few hours.
                  </p>
                </div>

                {/* Payment screenshot upload */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Payment Proof Screenshot (optional)</label>
                  {screenshotPreview ? (
                    <div className="relative rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                      <img src={screenshotPreview} alt="Payment screenshot" className="w-full max-h-64 object-contain bg-neutral-50 dark:bg-neutral-900" />
                      <button
                        onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
                        className="absolute top-2 right-2 rounded-lg bg-black/60 text-white p-1.5 hover:bg-black/80 transition"
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer py-6 px-4 transition group">
                      <div className="rounded-full bg-neutral-100 dark:bg-neutral-800 p-3 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 transition">
                        <Upload className="h-5 w-5 text-neutral-400 group-hover:text-brand-500 transition" />
                      </div>
                      <span className="text-xs text-neutral-500">Click to upload payment screenshot</span>
                      <span className="text-[10px] text-neutral-400">PNG, JPG up to 5MB</span>
                      <input type="file" accept="image/*" onChange={handleScreenshotSelect} className="hidden" />
                    </label>
                  )}
                </div>

                <Button onClick={handleUpiSubmit} loading={loading || uploading} className="w-full" icon={<ArrowRight className="h-4 w-4" />}>
                  {uploading ? 'Uploading screenshot...' : 'Submit Payment Proof'}
                </Button>
              </div>
            </>
          )}

          {upiStage === 'submitted' && (
            <div className="text-center py-6 space-y-4">
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6">
                <Clock className="h-12 w-12 text-amber-500 mx-auto mb-3 animate-pulse" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">Payment Under Review</h3>
                <p className="text-sm text-neutral-500">
                  Your transaction has been submitted for verification. You'll be able to activate once admin approves your payment.
                </p>
              </div>

              {existingRequests.filter(r => r.status === 'pending').map(req => (
                <div key={req.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-500">Transaction ID</span>
                    <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">{req.transaction_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">Status</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> Pending Verification
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {upiStage === 'approved' && existingRequests[0]?.license_code && (
            <div className="text-center py-6 space-y-4">
              <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-6">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">Payment Verified!</h3>
                <p className="text-sm text-neutral-500 mb-4">Your license code is ready. Click "Activate Now" to activate your license.</p>

                <div className="rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4">
                  <p className="text-xs text-neutral-500 mb-1">Your License Code</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-lg font-mono font-bold tracking-wider text-brand-600 dark:text-brand-400">
                      {existingRequests[0].license_code}
                    </code>
                    <button onClick={() => copyText(existingRequests[0].license_code!, 'License code')} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition">
                      <Copy className="h-4 w-4 text-neutral-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {upiStage === 'rejected' && (
            <div className="text-center py-6 space-y-4">
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">Payment Rejected</h3>
                <p className="text-sm text-neutral-500 mb-2">
                  {existingRequests[0]?.rejection_reason || "Your payment could not be verified. Please try again."}
                </p>
              </div>
              <Button onClick={() => setUpiStage('form')} variant="outline" className="w-full">
                Submit New Payment
              </Button>
            </div>
          )}
        </div>
      )}

      {/* GIFT CARD TAB */}
      {tab === 'giftcard' && (
        <div className="space-y-4">
          {giftStage === 'form' && (
            <>
              <div className="rounded-2xl border border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/10 p-5 text-center">
                <div className="inline-flex rounded-xl bg-white dark:bg-neutral-800 p-3 shadow-sm mb-3">
                  <Gift className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Have a Gift Card?</p>
                <p className="text-xs text-neutral-500 mt-1">Enter your gift card code to instantly get your license key</p>
              </div>

              <Input
                label="Gift Card Code"
                name="card_code"
                value={cardCode}
                onChange={(e) => setCardCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="text-center text-lg font-mono tracking-wider"
                error={undefined}
                autoFocus
              />

              <div className="flex items-start gap-2 rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3">
                <Sparkles className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <p className="text-xs text-green-600 dark:text-green-400">
                  Gift card redemption is instant — your license code will be revealed immediately after entering a valid code.
                </p>
              </div>

              <Button onClick={handleGiftCardRedeem} loading={loading} className="w-full" icon={<Gift className="h-4 w-4" />}>
                Redeem Gift Card
              </Button>
            </>
          )}

          {giftStage === 'success' && (
            <div className="text-center py-6 space-y-4">
              <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-6">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                  {mode === 'hub_add' ? 'Hub Credit Added!' : 'Gift Card Redeemed!'}
                </h3>
                <p className="text-sm text-neutral-500 mb-4">
                  {mode === 'hub_add'
                    ? 'You now have 1 additional hub credit. You can create a new hub from the Hubs page.'
                    : 'Your license code is ready. Click "Activate Now" to activate your license.'}
                </p>
                {mode !== 'hub_add' && (
                  <div className="rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4">
                    <p className="text-xs text-neutral-500 mb-1">Your License Code</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-mono font-bold tracking-wider text-brand-600 dark:text-brand-400">
                        {revealedLicense}
                      </code>
                      <button onClick={() => copyText(revealedLicense, 'License code')} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition">
                        <Copy className="h-4 w-4 text-neutral-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
