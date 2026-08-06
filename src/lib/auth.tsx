import { Profile } from '@/types';
import { Session,User } from '@supabase/supabase-js';
import { createContext,ReactNode,useCallback,useContext,useEffect,useState } from 'react';
import { confirm } from './confirm';
import { setActiveUserId } from './offline/db';
import { getQueueCount } from './offline/syncQueue';
import { getSubscriptionStatus } from './subscription';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsLicense?: boolean }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkLicenseExpired: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string): Promise<{ profile: Profile | null; error: any }> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, hub_id, can_create_hub, phone, company, location, created_at, is_approved, license_status, license_expires_at, license_activated_at, hub_add_credits, referral_code, referred_by, referral_earnings, plan_type, subscription_started_at, subscription_expires_at, subscription_status, last_payment_at, next_billing_at, renewal_count, hub: hubs!profiles_hub_id_fkey(*)')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.error('profile fetch error', error);
      setProfile(null);
      return { profile: null, error };
    }
    const prof = data as Profile | null;
    setProfile(prof);
    return { profile: prof, error: null };
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setActiveUserId(data.session?.user?.id ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setActiveUserId(newSession?.user?.id ?? null);
      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setProfile(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setLoading(true);
        (async () => {
          const { profile: fetched, error: fetchErr } = await fetchProfile(newSession.user.id);
          if (mounted) setLoading(false);
          if (fetchErr || !fetched) {
            await supabase.auth.signOut();
            setActiveUserId(null);
            setSession(null);
            setProfile(null);
          }
        })();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    if (data.session) {
      setSession(data.session);
      setActiveUserId(data.session.user.id);
      const { profile: fetched, error: fetchErr } = await fetchProfile(data.session.user.id);
      setLoading(false);
      if (fetchErr) {
        await supabase.auth.signOut();
        setActiveUserId(null);
        setSession(null);
        setProfile(null);
        return { error: `Failed to load profile: ${fetchErr.message}` };
      }
      if (!fetched) {
        await supabase.auth.signOut();
        setActiveUserId(null);
        setSession(null);
        setProfile(null);
        return { error: 'Your account has been removed. Please contact your administrator.' };
      }
      if (fetched.role === 'trial_user' && fetched.is_approved === false) {
        await supabase.auth.signOut();
        setActiveUserId(null);
        setSession(null);
        setProfile(null);
        return { error: 'Your account is pending admin approval. Please contact the administrator.' };
      }
      // Super admin is exempt from license/subscription expiry
      if (fetched.role !== 'super_admin' && fetched.role === 'hub_admin') {
        const subStatus = getSubscriptionStatus(fetched);
        if (subStatus === 'expired') {
          await supabase.auth.signOut();
          setActiveUserId(null);
          setSession(null);
          setProfile(null);
          return { error: 'Your monthly subscription has expired. Renew it to continue using HubVault.' };
        }
        if (fetched.license_status === 'pending') {
          const expiresAt = fetched.license_expires_at ? new Date(fetched.license_expires_at) : null;
          if (expiresAt && expiresAt < new Date()) {
            await supabase.auth.signOut();
            setActiveUserId(null);
            setSession(null);
            setProfile(null);
            return { error: 'Your 30-day free access period has ended. Choose a plan to continue using HubVault.' };
          }
        }
      }
    }
    return { error: null };
  }, [fetchProfile]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'guest' } },
    });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    if (data.session) {
      setSession(data.session);
      setActiveUserId(data.session.user.id);
      await fetchProfile(data.session.user.id);
    }
    setLoading(false);
    return { error: null };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) {
      const pendingCount = await getQueueCount(uid);
      if (pendingCount > 0) {
        const ok = await confirm({
          title: 'Unsynced Changes Warning',
          message: `You have ${pendingCount} unsynced offline change${pendingCount > 1 ? 's' : ''}. Signing out will switch user context. Unsynced changes remain saved on this device for your account, but will not sync until you log back in. Are you sure you want to sign out?`,
          confirmLabel: 'Sign Out',
          danger: true,
        });
        if (!ok) return;
      }
    }
    await supabase.auth.signOut();
    setActiveUserId(null);
    setProfile(null);
    setSession(null);
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const checkLicenseExpired = useCallback(async (): Promise<boolean> => {
    if (!session?.user || !profile) return false;
    if (profile.role === 'super_admin') return false;
    return getSubscriptionStatus(profile) === 'expired';
  }, [session, profile]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut, refreshProfile, checkLicenseExpired }}>
      {children}
    </AuthContext.Provider>
  );
}
