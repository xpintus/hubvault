import Modal from '@/components/ui/Modal';
import { Button,Input } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { supabase,SUPABASE_URL } from '@/lib/supabase';
import { Profile } from '@/types';
import { AlertTriangle,CheckCircle2,Clock,Gift,KeyRound,ShieldCheck } from 'lucide-react';
import { useEffect,useState } from 'react';
import RequestLicenseModal from './RequestLicenseModal';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

interface LicenseActivationModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onActivated: () => void;
  onExpired: () => void;
}

export default function LicenseActivationModal({ open, onClose, profile, onActivated, onExpired }: LicenseActivationModalProps) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [status, setStatus] = useState<'pending' | 'expired' | 'activated' | 'none'>('pending');
  const [countdown, setCountdown] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setStatus(profile.license_status === 'expired' ? 'expired' : 'pending');
  }, [open, profile.license_status]);

  useEffect(() => {
    if (!open || status !== 'pending') return;
    const expiresAt = profile.license_expires_at;
    if (!expiresAt) return;

    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        setStatus('expired');
        onExpired();
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [open, status, profile.license_expires_at, onExpired]);

  const handleActivate = async () => {
    if (!code.trim()) {
      toast.error('Please enter your license code');
      return;
    }
    setActivating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${FUNCTION_URL}?action=activate-license`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ license_code: code.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 410) {
          setStatus('expired');
          onExpired();
        }
        throw new Error(data.error || 'Activation failed');
      }
      setStatus('activated');
      toast.success('License activated successfully!');
      setTimeout(() => {
        onActivated();
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={status === 'activated' ? onActivated : onClose}
      title={status === 'activated' ? 'Activation Successful' : status === 'expired' ? 'License Expired' : 'Activate Your License'}
      subtitle={status === 'pending' ? 'Enter the activation code provided by your administrator' : undefined}
      size="sm"
      closable={status !== 'activated'}
      footer={
        status === 'pending' ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Skip for now
            </Button>
            <Button onClick={handleActivate} loading={activating} icon={<KeyRound className="h-4 w-4" />}>
              Activate
            </Button>
          </>
        ) : status === 'expired' ? (
          <Button variant="outline" onClick={onClose}>Close</Button>
        ) : undefined
      }
    >
      {status === 'activated' ? (
        <div className="text-center py-6">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">License Activated!</h3>
          <p className="text-sm text-neutral-500">Your license is now active. You can continue using the dashboard.</p>
        </div>
      ) : status === 'expired' ? (
        <div className="text-center py-6">
          <AlertTriangle className="h-14 w-14 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">License Expired</h3>
          <p className="text-sm text-neutral-500 mb-4">
            Your 30-day free access period has ended. Choose a paid plan to continue using HubVault.
          </p>
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-left">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              Your account will be locked. You need a new license code from your Super Admin to continue using the dashboard.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-600/10 text-brand-600 p-2.5 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">License Activation Required</p>
              <p className="text-xs text-neutral-500">Your account includes 30 days of free access. Activate anytime to keep access after the trial.</p>
            </div>
          </div>

          {countdown && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Time remaining: <strong className="font-mono">{countdown}</strong>
                </p>
                <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                  After this window, your account will be locked until a new code is issued.
                </p>
              </div>
            </div>
          )}

          <div>
            <Input
              label="License Code"
              name="license_code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="text-center text-lg font-mono tracking-wider"
              error={undefined}
              autoFocus
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-500">
              You can skip this step and use the dashboard for now, but your account will be locked if you don't activate before the deadline.
            </p>
          </div>

          <Button variant="outline" onClick={() => setRequestOpen(true)} className="w-full" icon={<Gift className="h-4 w-4" />}>
            Don't have a code? Request License
          </Button>
        </div>
      )}

      <RequestLicenseModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        profile={profile}
        onLicenseObtained={(licCode) => {
          setRequestOpen(false);
          setCode(licCode);
          toast.success('License code loaded! Click Activate to continue.');
        }}
      />
    </Modal>
  );
}
