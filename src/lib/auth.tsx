import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile } from '@/types';

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

  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, hub: hubs!profiles_hub_id_fkey(*)')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.error('profile fetch error', error);
      setProfile(null);
      return null;
    }
    setProfile(data as Profile | null);
    return data as Profile | null;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setProfile(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setLoading(true);
        (async () => {
          const fetched = await fetchProfile(newSession.user.id);
          if (mounted) setLoading(false);
          if (!fetched) {
            await supabase.auth.signOut();
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
      const fetched = await fetchProfile(data.session.user.id);
      setLoading(false);
      if (!fetched) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return { error: 'Your account has been removed. Please contact your administrator.' };
      }
      if (fetched.role === 'trial_user' && fetched.is_approved === false) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return { error: 'Your account is pending admin approval. Please contact the administrator.' };
      }
      // Check license status for hub_admin
      if (fetched.role === 'hub_admin' && fetched.license_status === 'expired') {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return { error: 'Your license has expired. Please contact your administrator for a new activation code.' };
      }
      if (fetched.role === 'hub_admin' && fetched.license_status === 'pending') {
        const expiresAt = fetched.license_expires_at ? new Date(fetched.license_expires_at) : null;
        if (expiresAt && expiresAt < new Date()) {
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          return { error: 'Your 24-hour activation window has passed. Please contact your administrator for a new activation code.' };
        }
        // Pending hub_admins go straight to dashboard — activation popup shows there
        return { error: null };
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
      await fetchProfile(data.session.user.id);
    }
    setLoading(false);
    return { error: null };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const checkLicenseExpired = useCallback(async (): Promise<boolean> => {
    if (!session?.user || !profile) return false;
    if (profile.role !== 'hub_admin') return false;
    if (profile.license_status === 'activated') return false;
    if (profile.license_status === 'expired') return true;
    if (profile.license_status === 'pending' && profile.license_expires_at) {
      return new Date(profile.license_expires_at) < new Date();
    }
    return false;
  }, [session, profile]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut, refreshProfile, checkLicenseExpired }}>
      {children}
    </AuthContext.Provider>
  );
}
