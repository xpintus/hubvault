import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Edit3, Trash2, BookOpen, Building2, Phone, MapPin, FileText } from 'lucide-react';
import { Party } from '@/types';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { useToast } from '@/components/ui/Toast';
import { confirm } from '@/lib/confirm';
import { Button, Card, EmptyState, Skeleton, Badge } from '@/components/ui/primitives';
import { fetchParties, createParty, updateParty, deleteParty, formatINRNumber } from '@/lib/khatabook';
import PartyModal from '@/components/khatabook/PartyModal';

export default function Parties() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const hubCtx = useHub();
  const isSuperAdmin = profile?.role === 'super_admin';
  const effectiveHubId = isSuperAdmin ? hubCtx.selectedHubId : profile?.hub_id ?? null;

  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchParties(effectiveHubId);
      setParties(data);
    } catch (err) {
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  }, [effectiveHubId, toast]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.company_name || '').toLowerCase().includes(q) ||
        (p.mobile || '').includes(q) ||
        (p.gstin || '').toLowerCase().includes(q)
      );
    });
  }, [parties, searchQuery]);

  const handleDelete = async (party: Party) => {
    const ok = await confirm({
      title: `Delete Party "${party.name}"?`,
      message: 'This will delete the party master and all associated transactions. This action cannot be undone.',
      confirmLabel: 'Delete Party',
    });
    if (!ok) return;

    try {
      await deleteParty(party.id, profile?.id, party.hub_id || undefined);
      toast.success('Party deleted successfully');
      loadParties();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete party');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Party Master</h2>
          <p className="text-xs text-neutral-500">Manage all registered party accounts and opening balances</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, company, mobile, GST..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 py-1.5 text-xs w-full"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingParty(null);
              setShowModal(true);
            }}
            icon={<Plus className="h-4 w-4" />}
          >
            Add New Party
          </Button>
        </div>
      </div>

      {/* Parties Table / Card List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filteredParties.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No Parties Registered"
          message="Create your first party master to begin tracking transactions."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditingParty(null);
                setShowModal(true);
              }}
              icon={<Plus className="h-4 w-4" />}
            >
              Add New Party
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3">Party Name</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Mobile</th>
                  <th className="px-5 py-3">GSTIN</th>
                  <th className="px-5 py-3 text-right">Opening Balance</th>
                  <th className="px-5 py-3 text-center">Type</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredParties.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition">
                    <td className="px-5 py-3.5 font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      {p.company_name || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      {p.mobile || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                      {p.gstin || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                      {formatINRNumber(p.opening_balance)}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <Badge color={p.opening_balance_type === 'receivable' ? 'red' : 'blue'}>
                        {p.opening_balance_type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/khatabook/ledger?party_id=${p.id}`)}
                          icon={<BookOpen className="h-3.5 w-3.5" />}
                          title="View Ledger"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingParty(p);
                            setShowModal(true);
                          }}
                          icon={<Edit3 className="h-3.5 w-3.5" />}
                          title="Edit Party"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(p)}
                          icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                          title="Delete Party"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      <PartyModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingParty(null);
        }}
        editingParty={editingParty}
        selectedHubId={effectiveHubId}
        onSave={async (input) => {
          if (editingParty) {
            await updateParty(editingParty.id, input, profile?.id);
          } else {
            await createParty(input, profile?.id);
          }
          loadParties();
        }}
      />
    </div>
  );
}
