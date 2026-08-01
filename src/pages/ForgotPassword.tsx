import { Button,Input } from '@/components/ui/primitives';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import {
AlertCircle,
ArrowLeft,ArrowRight,
CheckCircle2,
Eye,EyeOff,
KeyRound,
Mail,ShieldCheck,
Wallet,
} from 'lucide-react';
import { useEffect,useRef,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

type Step = 'email' | 'otp' | 'reset' | 'done';

const OTP_LENGTH = 8;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to send OTP. Please try again.');
      return;
    }
    toast.success('Password reset code sent to your email');
    setStep('otp');
    setResendTimer(60);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    if (digits.length === 0) return;
    const next = Array<string>(OTP_LENGTH).fill('');
    digits.forEach((d, i) => (next[i] = d));
    setOtp(next);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      toast.error(`Please enter the complete ${OTP_LENGTH}-digit code`);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'email',
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Invalid or expired code. Please try again.');
      return;
    }
    if (data?.session || data?.user) {
      setStep('reset');
      toast.success('Code verified! Set your new password.');
    } else {
      toast.error('Verification failed. Please try again.');
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      toast.error('Failed to resend code. Please try again.');
      return;
    }
    toast.success('New code sent to your email');
    setResendTimer(60);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to reset password. Please try again.');
      return;
    }
    setStep('done');
    toast.success('Password reset successfully!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A] p-6 relative">
      <div className="absolute top-5 right-5 flex items-center gap-3">
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to login</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <Link to="/" className="flex items-center gap-3 mb-8 group w-fit" title="Back to homepage">
          <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2.5 text-white shadow-glow transition-transform group-hover:scale-105 group-active:scale-95">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">HubVault</h1>
            <p className="text-sm text-neutral-500">Collection Reconciliation Suite</p>
          </div>
        </Link>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(['email', 'otp', 'reset', 'done'] as Step[]).map((s, i) => {
            const activeIndex = (['email', 'otp', 'reset', 'done'] as Step[]).indexOf(step);
            const isActive = i <= activeIndex;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-brand-600 flex-1' : 'bg-neutral-200 dark:bg-neutral-700 flex-1'}`}
                />
              </div>
            );
          })}
        </div>

        {/* Step: Email */}
        {step === 'email' && (
          <div className="card p-7 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-50 dark:bg-brand-600/15 p-2.5 text-brand-600 dark:text-brand-400">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Forgot Password?</h2>
                <p className="text-sm text-neutral-500">Enter your email to receive a reset code.</p>
              </div>
            </div>
            <form onSubmit={handleSendOtp} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
                Send Reset Code
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <div className="card p-7 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-50 dark:bg-brand-600/15 p-2.5 text-brand-600 dark:text-brand-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Enter Reset Code</h2>
                <p className="text-sm text-neutral-500">
                  We sent an {OTP_LENGTH}-digit code to <span className="font-semibold text-neutral-700 dark:text-neutral-300">{email}</span>
                </p>
              </div>
            </div>
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex justify-center gap-1.5 sm:gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-12 w-9 sm:h-14 sm:w-11 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-[var(--card-bg)] text-center text-2xl font-bold text-neutral-800 dark:text-neutral-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 outline-none transition-all"
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
                Verify Code
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-sm text-neutral-400">
                    Resend code in {resendTimer}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline transition"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Step: Reset Password */}
        {step === 'reset' && (
          <div className="card p-7 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-50 dark:bg-brand-600/15 p-2.5 text-brand-600 dark:text-brand-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Set New Password</h2>
                <p className="text-sm text-neutral-500">Choose a strong password for your account.</p>
              </div>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-[38px] text-neutral-400 hover:text-brand-600 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                label="Confirm New Password"
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
              />
              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
                Reset Password
                {!loading && <CheckCircle2 className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="card p-8 text-center space-y-5 animate-fade-in">
            <div className="mx-auto rounded-2xl bg-success-50 dark:bg-success-500/15 p-5 text-success-600 dark:text-success-400 w-fit">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Password Reset Complete!</h2>
              <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => navigate('/login')}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Back to Login
            </Button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Check your spam folder if you don't see the email</span>
        </div>
      </div>
    </div>
  );
}
