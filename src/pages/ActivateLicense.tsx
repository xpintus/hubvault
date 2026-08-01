import RequestLicenseModal from '@/components/RequestLicenseModal';
import { Button,Input,Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { supabase,SUPABASE_URL } from '@/lib/supabase';
import { AlertTriangle,CheckCircle2,Clock,Gift,KeyRound,ShieldCheck,ShoppingCart } from 'lucide-react';
import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

export default function ActivateLicense() {
  const { profile, loading, checkLicenseExpired: _checkLicenseExpired, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [status, setStatus] = useState<'loading' | 'pending' | 'expired' | 'activated' | 'none'>('loading');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      navigate('/login');
      return;
    }
    if (profile.role !== 'hub_admin') {
      navigate('/dashboard');
      return;
    }
    if (profile.license_status === 'activated') {
      navigate('/dashboard');
      return;
    }
    if (profile.license_status === 'expired') {
      setStatus('expired');
      return;
    }
    setStatus('pending');
    setExpiresAt(profile.license_expires_at ?? null);
  }, [profile, loading, navigate]);

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
        }
        throw new Error(data.error || 'Activation failed');
      }
      setStatus('activated');
      toast.success('License activated successfully! Redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const formatCountdown = () => {
    if (!expiresAt) return null;
    const now = new Date();
    const deadline = new Date(expiresAt);
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return 'expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const countdown = formatCountdown();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--page-bg)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-glow">
            <KeyRound className="h-6 w-6" />
          </div>
          <div className="text-left">
            <p className="font-bold text-neutral-900 dark:text-neutral-100 text-lg">HubVault</p>
            <p className="text-xs text-neutral-500">License Activation</p>
          </div>
        </div>

        {status === 'activated' ? (
          <div className="rounded-2xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 p-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Activation Successful!</h2>
            <p className="text-sm text-neutral-500">Your license is now active. Redirecting you to the dashboard...</p>
          </div>
        ) : status === 'expired' ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-8 text-center">
            <AlertTriangle className="h-14 w-14 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">License Expired</h2>
            <p className="text-sm text-neutral-500 mb-6">
              Your 24-hour activation window has passed. Please contact your administrator to get a new activation code.
            </p>
            <Button variant="outline" onClick={handleSignOut} className="w-full">Sign Out</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] p-8 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-brand-600/10 text-brand-600 p-2.5">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Activate Your License</h2>
                <p className="text-xs text-neutral-500">Enter the activation code provided by your administrator</p>
              </div>
            </div>

            {countdown && countdown !== 'expired' && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 mb-5">
                <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Time remaining to activate: <strong>{countdown}</strong>
                  <br />After this window closes, your account will be locked until a new code is issued.
                </p>
              </div>
            )}

            <div className="space-y-4">
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
              <Button onClick={handleActivate} loading={activating} className="w-full" icon={<KeyRound className="h-4 w-4" />}>
                Activate License
              </Button>
              <button onClick={handleSignOut} className="w-full text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition">
                Sign out and activate later
              </button>
            </div>
          </div>
        )}

        {/* Request License Section */}
        {status !== 'activated' && (
          <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] p-6 shadow-soft">
            <div className="text-center">
              <div className="inline-flex rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-glow mb-3">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">Don't have a license code?</h3>
              <p className="text-xs text-neutral-500 mb-4">Pay via UPI or redeem a gift card to get your activation code instantly.</p>
              <Button
                variant="outline"
                onClick={() => setRequestModalOpen(true)}
                className="w-full"
                icon={<Gift className="h-4 w-4" />}
              >
                Request License Key
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-neutral-400 mt-6">
          Need help? Contact your administrator.
        </p>
      </div>

      {/* Request License Modal */}
      {profile && (
        <RequestLicenseModal
          open={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          profile={profile}
          onLicenseObtained={(licCode) => {
            setRequestModalOpen(false);
            setCode(licCode);
            toast.success('License code loaded! Click Activate to continue.');
          }}
        />
      )}
    </div>
  );
}
