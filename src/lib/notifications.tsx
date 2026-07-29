import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

interface NotificationContextValue {
  pendingPayments: number;
  unreadHubNotifications: number;
  pendingPayouts: number;
  totalUnread: number;
  refreshPayments: () => Promise<void>;
  refreshHubNotifications: () => Promise<void>;
  markHubNotificationsRead: () => Promise<void>;
  refreshPayouts: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [pendingPayments, setPendingPayments] = useState(0);
  const [unreadHubNotifications, setUnreadHubNotifications] = useState(0);
  const [pendingPayouts, setPendingPayouts] = useState(0);

  const refreshPayments = useCallback(async () => {
    if (!isSuperAdmin) {
      setPendingPayments(0);
      return;
    }
    const { count, error } = await supabase
      .from('license_payment_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error && count !== null) {
      setPendingPayments(count);
    }
  }, [isSuperAdmin]);

  const refreshHubNotifications = useCallback(async () => {
    if (!isSuperAdmin) {
      setUnreadHubNotifications(0);
      return;
    }
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('type', 'hub_created');
    if (!error && count !== null) {
      setUnreadHubNotifications(count);
    }
  }, [isSuperAdmin]);

  const refreshPayouts = useCallback(async () => {
    if (!isSuperAdmin) {
      setPendingPayouts(0);
      return;
    }
    const { count, error } = await supabase
      .from('withdrawal_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error && count !== null) {
      setPendingPayouts(count);
    }
  }, [isSuperAdmin]);

  const markHubNotificationsRead = useCallback(async () => {
    if (!isSuperAdmin) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('type', 'hub_created');
    if (!error) {
      setUnreadHubNotifications(0);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setPendingPayments(0);
      setUnreadHubNotifications(0);
      return;
    }

    refreshPayments();
    refreshHubNotifications();
    refreshPayouts();

    const channel = supabase
      .channel('payment-requests-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'license_payment_requests' },
        () => { refreshPayments(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'license_payment_requests' },
        () => { refreshPayments(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => { refreshHubNotifications(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        () => { refreshHubNotifications(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'withdrawal_requests' },
        () => { refreshPayouts(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'withdrawal_requests' },
        () => { refreshPayouts(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, refreshPayments, refreshHubNotifications, refreshPayouts]);

  const totalUnread = pendingPayments + unreadHubNotifications + pendingPayouts;

  return (
    <NotificationContext.Provider value={{ pendingPayments, unreadHubNotifications, pendingPayouts, totalUnread, refreshPayments, refreshHubNotifications, markHubNotificationsRead, refreshPayouts }}>
      {children}
    </NotificationContext.Provider>
  );
}
