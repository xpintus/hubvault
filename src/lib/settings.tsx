import { createContext,ReactNode,useCallback,useContext,useEffect,useState } from 'react';
import { supabase } from './supabase';

export interface AppSettings {
  upi_id: string;
  payee_name: string;
  qr_image_url: string | null;
  license_price: number;
  monthly_price: number;
  hub_add_price: number;
  adsense_client: string | null;
  adsense_enabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  upi_id: 'BHARATPE09899107906@yesbankltd',
  payee_name: 'HubVault License',
  qr_image_url: '/ChatGPT_Image_Jul_28,_2026,_11_30_59_PM.png',
  license_price: 999,
  monthly_price: 99,
  hub_add_price: 499,
  adsense_client: null,
  adsense_enabled: false,
};

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('upi_id, payee_name, qr_image_url, license_price, monthly_price, hub_add_price, adsense_client, adsense_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) {
      setSettings(data as AppSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings.adsense_enabled || !settings.adsense_client) return;
    const existing = document.querySelector('script[data-adsense]');
    if (existing) {
      if (existing.getAttribute('data-ad-client') !== settings.adsense_client) {
        existing.remove();
      } else {
        return;
      }
    }
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-adsense', '');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${settings.adsense_client}`;
    document.head.appendChild(script);
  }, [settings.adsense_enabled, settings.adsense_client]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}
