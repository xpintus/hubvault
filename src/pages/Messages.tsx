import { useToast } from '@/components/ui/Toast';
import { Button,Card,EmptyState,Skeleton } from '@/components/ui/primitives';
import { confirm } from '@/lib/confirm';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { ContactMessage } from '@/types';
import { clsx } from 'clsx';
import {
ArrowLeft,
Building2,
Calendar,
Circle,
Inbox,
Mail,
MailOpen,
Phone,
Search,Trash2,
User,
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';

export default function Messages() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selected, setSelected] = useState<ContactMessage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setMessages(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const unreadCount = useMemo(() => messages.filter((m) => !m.is_read).length, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter === 'unread' && m.is_read) return false;
      if (filter === 'read' && !m.is_read) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    });
  }, [messages, search, filter]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
    if (error) {
      toast.error('Failed to mark as read');
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, is_read: true } : prev));
  }, [toast]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete message?',
      message: 'This message will be permanently removed.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('contact_messages').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete message');
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setSelected(null);
    toast.success('Message deleted');
  };

  const openMessage = (msg: ContactMessage) => {
    setSelected(msg);
    if (!msg.is_read) markAsRead(msg.id);
  };

  if (selected) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Messages
        </button>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-neutral-200 dark:border-neutral-800">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{selected.subject}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  {selected.name}
                </span>
                <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 text-brand-600 hover:text-brand-600 font-medium">
                  <Mail className="h-4 w-4" />
                  {selected.email}
                </a>
                {selected.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    {selected.phone}
                  </span>
                )}
              </div>
              {selected.company && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
                  <Building2 className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  {selected.company}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateTime(selected.created_at)}
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleDelete(selected.id)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>

          <div className="mt-5">
            <p className="text-[15px] text-neutral-700 dark:text-neutral-300 leading-[1.75] whitespace-pre-wrap">{selected.message}</p>
          </div>

          <div className="mt-8 pt-5 border-t border-neutral-200 dark:border-neutral-800">
            <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}>
              <Button variant="outline" size="md">
                <Mail className="h-4 w-4" />
                Reply via Email
              </Button>
            </a>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Messages</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Contact form submissions from your website.
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-lg bg-brand-50 dark:bg-brand-600/15 px-2 py-0.5 text-xs font-bold text-brand-600 ring-1 ring-inset ring-brand-600/30">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or subject…"
            className="input-base pl-10"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-[var(--card-bg)] p-1">
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition',
                filter === f ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-soft' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title="No messages"
            message={filter === 'unread' ? 'No unread messages. You are all caught up!' : 'Contact form submissions will appear here.'}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.map((msg) => (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                className="w-full flex items-start gap-4 p-4 hover:bg-neutral-100 dark:hover:bg-neutral-950/70 transition-colors text-left"
              >
                <div className={clsx('shrink-0 mt-1', msg.is_read ? 'text-neutral-500 dark:text-neutral-400' : 'text-brand-600')}>
                  {msg.is_read ? <MailOpen className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!msg.is_read && <Circle className="h-2 w-2 fill-brand-600 text-brand-600 shrink-0" />}
                    <p className={clsx('text-sm truncate', msg.is_read ? 'font-medium text-neutral-500 dark:text-neutral-400' : 'font-bold text-neutral-900 dark:text-neutral-100')}>
                      {msg.subject}
                    </p>
                  </div>
                  <p className={clsx('mt-1 text-sm truncate', msg.is_read ? 'text-neutral-500' : 'text-neutral-700 dark:text-neutral-300')}>
                    <span className="font-medium">{msg.name}</span>
                    {' — '}
                    {msg.message}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {msg.email}
                    </span>
                    {msg.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {msg.company}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
