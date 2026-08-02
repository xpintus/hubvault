import { createContext,ReactNode,useCallback,useContext,useEffect,useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

interface NotificationContextValue {
  pendingPayments: number;
  unreadHubNotifications: number;
  unreadBuyerNotifications: number;
  pendingPayouts: number;
  totalUnread: number;
  refreshPayments: () => Promise<void>;
  refreshHubNotifications: () => Promise<void>;
  markHubNotificationsRead: () => Promise<void>;
  markBuyerNotificationsRead: () => Promise<void>;
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
  const [unreadBuyerNotifications, setUnreadBuyerNotifications] = useState(0);
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

  const refreshBuyerNotifications = useCallback(async () => {
    if (!isSuperAdmin) {
      setUnreadBuyerNotifications(0);
      return;
    }
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('type', 'buyer_registered');
    if (!error && count !== null) setUnreadBuyerNotifications(count);
  }, [isSuperAdmin]);

  const markBuyerNotificationsRead = useCallback(async () => {
    if (!isSuperAdmin) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('type', 'buyer_registered');
    if (!error) setUnreadBuyerNotifications(0);
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
      setUnreadBuyerNotifications(0);
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
    refreshBuyerNotifications();

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
        () => { refreshHubNotifications(); refreshBuyerNotifications(); refreshPayments(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        () => { refreshHubNotifications(); refreshBuyerNotifications(); refreshPayments(); }
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
  }, [isSuperAdmin, refreshPayments, refreshHubNotifications, refreshPayouts, refreshBuyerNotifications]);

  const totalUnread = pendingPayments + unreadHubNotifications + unreadBuyerNotifications + pendingPayouts;

  return (
    <NotificationContext.Provider value={{ pendingPayments, unreadHubNotifications, unreadBuyerNotifications, pendingPayouts, totalUnread, refreshPayments, refreshHubNotifications, markHubNotificationsRead, markBuyerNotificationsRead, refreshPayouts }}>
      {children}
    </NotificationContext.Provider>
  );
}
