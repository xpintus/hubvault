import { useEffect, useRef } from 'react';
import { useSettings } from '@/lib/settings';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  slot: string;
  format?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a Google AdSense ad unit that blends into the surrounding layout.
 * No visible label or border — styled to match nearby content cards.
 * Reads the publisher ID and enabled flag from the database via SettingsProvider.
 */
export default function AdSlot({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  style,
}: AdSlotProps) {
  const { settings } = useSettings();
  const insRef = useRef<HTMLModElement>(null);

  const client = settings.adsense_client;
  const enabled = settings.adsense_enabled;

  useEffect(() => {
    if (!enabled || !client) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet (e.g. ad blockers) — silently skip
    }
  }, [enabled, client, slot]);

  if (!enabled || !client) return null;

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={{ display: 'block', ...style }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
