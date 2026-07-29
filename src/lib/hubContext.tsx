import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { Hub } from '@/types';

interface HubContextValue {
  accessibleHubs: Hub[];
  selectedHub: Hub | null;
  selectedHubId: string;
  isAllHubs: boolean;
  canSwitchHub: boolean;
  selectHub: (hubId: string) => void;
  selectAllHubs: () => void;
  loading: boolean;
  refresh: () => void;
}

const HubContext = createContext<HubContextValue | null>(null);

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub must be used within HubProvider');
  return ctx;
}

const STORAGE_KEY = 'cr_selected_hub';

export function HubProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [accessibleHubs, setAccessibleHubs] = useState<Hub[]>([]);
  const [selectedHubId, setSelectedHubIdState] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadHubs = useCallback(async () => {
    if (!profile) {
      setAccessibleHubs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (profile.role === 'super_admin') {
        const { data, error } = await supabase.from('hubs').select('*').order('name');
        if (error) throw error;
        setAccessibleHubs(data ?? []);
      } else {
        const { data, error } = await supabase
          .from('user_hub_access')
          .select('hub: hubs(*)')
          .eq('user_id', profile.id);
        if (error) throw error;
        const hubs = (data ?? [])
          .map((row) => (Array.isArray(row.hub) ? row.hub[0] : row.hub))
          .filter((h): h is Hub => h !== null && !Array.isArray(h))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAccessibleHubs(hubs);
      }
    } catch {
      setAccessibleHubs([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadHubs();
  }, [loadHubs]);

  useEffect(() => {
    if (accessibleHubs.length === 0) {
      setSelectedHubIdState('');
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (profile?.role === 'super_admin') {
      if (stored === 'all') {
        setSelectedHubIdState('all');
        return;
      }
      if (stored && accessibleHubs.some((h) => h.id === stored)) {
        setSelectedHubIdState(stored);
        return;
      }
      setSelectedHubIdState('all');
      return;
    }
    if (stored && accessibleHubs.some((h) => h.id === stored)) {
      setSelectedHubIdState(stored);
    } else {
      setSelectedHubIdState(accessibleHubs[0].id);
    }
  }, [accessibleHubs, profile]);

  const selectHub = useCallback((hubId: string) => {
    setSelectedHubIdState(hubId);
    localStorage.setItem(STORAGE_KEY, hubId);
  }, []);

  const selectAllHubs = useCallback(() => {
    setSelectedHubIdState('all');
    localStorage.setItem(STORAGE_KEY, 'all');
  }, []);

  const isAllHubs = selectedHubId === 'all';
  const selectedHub = accessibleHubs.find((h) => h.id === selectedHubId) ?? null;
  const canSwitchHub = profile?.role === 'super_admin' || (profile?.role === 'hub_admin' && accessibleHubs.length > 1);

  return (
    <HubContext.Provider value={{
      accessibleHubs,
      selectedHub,
      selectedHubId: isAllHubs ? '' : selectedHubId,
      isAllHubs,
      canSwitchHub,
      selectHub,
      selectAllHubs,
      loading,
      refresh: loadHubs,
    }}>
      {children}
    </HubContext.Provider>
  );
}
