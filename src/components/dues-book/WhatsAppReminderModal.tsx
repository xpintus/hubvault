import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/primitives';
import { formatINR } from '@/lib/format';
import { generateWhatsAppMessage, logRiderMessage } from '@/lib/riderDuesService';
import { RiderLedgerSummary, RiderMessageType } from '@/types';
import {
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Phone,
  Smartphone,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

const MESSAGE_TEMPLATES: { type: RiderMessageType; label: string; desc: string }[] = [
  {
    type: 'Dues Reminder',
    label: 'Standard Dues Reminder',
    desc: 'Formal summary of total dues, recovered and pending balance',
  },
  {
    type: 'Payment Follow-up',
    label: 'Payment Follow-up',
    desc: 'Polite reminder to hand over cash/online UTR during evening closing',
  },
  {
    type: 'Recovery Confirmation',
    label: 'Recovery Confirmation',
    desc: 'Acknowledges receipt of recovery payment and shows remaining balance',
  },
  {
    type: 'Final Payment Reminder',
    label: 'Urgent / Final Notice',
    desc: 'Critical reminder for overdue amounts before hold on DRS assignments',
  },
  {
    type: 'Custom Message',
    label: 'Custom Message',
    desc: 'Compose your own custom notification for the rider',
  },
];

interface WhatsAppReminderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  riderSummary: RiderLedgerSummary | null;
  currentUserId?: string | null;
}

export default function WhatsAppReminderModal({
  open,
  onClose,
  onSuccess,
  riderSummary,
  currentUserId,
}: WhatsAppReminderModalProps) {
  const toast = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState<RiderMessageType>('Dues Reminder');
  const [customNote, setCustomNote] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<'WhatsApp' | 'SMS'>('WhatsApp');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!riderSummary) return;
    const text = generateWhatsAppMessage(selectedTemplate, riderSummary, customNote);
    setMessageBody(text);
  }, [riderSummary, selectedTemplate, customNote]);

  if (!riderSummary) return null;

  // Clean phone number for WhatsApp link (strip non-digits)
  const rawPhone = riderSummary.phone || '';
  const digitsOnly = rawPhone.replace(/\D/g, '');
  const internationalPhone =
    digitsOnly.length === 10
      ? `91${digitsOnly}`
      : digitsOnly.startsWith('91')
      ? digitsOnly
      : digitsOnly;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      setCopied(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2500);

      // Log drafted/copied message
      await logRiderMessage({
        rider_id: riderSummary.riderId,
        hub_id: riderSummary.hubId,
        message_type: selectedTemplate,
        recipient_phone: riderSummary.phone,
        message_body: messageBody,
        channel,
        status: 'drafted_copied',
        snapshot_dues: riderSummary.totalDues,
        snapshot_recovered: riderSummary.totalRecovered,
        snapshot_balance: riderSummary.outstandingBalance,
        created_by: currentUserId,
      });
      onSuccess();
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!digitsOnly || digitsOnly.length < 10) {
      toast.error('Rider has no valid mobile phone number configured');
      return;
    }

    setSaving(true);
    try {
      // 1. Log message to rider_dues_messages
      await logRiderMessage({
        rider_id: riderSummary.riderId,
        hub_id: riderSummary.hubId,
        message_type: selectedTemplate,
        recipient_phone: riderSummary.phone,
        message_body: messageBody,
        channel: 'WhatsApp',
        status: 'sent_via_whatsapp',
        snapshot_dues: riderSummary.totalDues,
        snapshot_recovered: riderSummary.totalRecovered,
        snapshot_balance: riderSummary.outstandingBalance,
        created_by: currentUserId,
      });

      // 2. Open WhatsApp Web or Mobile App
      const encoded = encodeURIComponent(messageBody);
      const url = `https://wa.me/${internationalPhone}?text=${encoded}`;
      window.open(url, '_blank', 'noopener,noreferrer');

      toast.success(
        `Opened WhatsApp link for ${riderSummary.riderName}. Confirm delivery in chat.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch message');
    } finally {
      setSaving(false);
    }
  };

  const handleSendSMS = async () => {
    if (!digitsOnly || digitsOnly.length < 10) {
      toast.error('Rider has no valid mobile phone number configured');
      return;
    }

    setSaving(true);
    try {
      await logRiderMessage({
        rider_id: riderSummary.riderId,
        hub_id: riderSummary.hubId,
        message_type: selectedTemplate,
        recipient_phone: riderSummary.phone,
        message_body: messageBody,
        channel: 'SMS',
        status: 'sent_via_sms_link',
        snapshot_dues: riderSummary.totalDues,
        snapshot_recovered: riderSummary.totalRecovered,
        snapshot_balance: riderSummary.outstandingBalance,
        created_by: currentUserId,
      });

      const encoded = encodeURIComponent(messageBody);
      const url = `sms:${internationalPhone}?body=${encoded}`;
      window.open(url, '_self');

      toast.success(`Prepared SMS for ${riderSummary.riderName}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger SMS');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Dues Reminder"
      subtitle={`Dispatch live WhatsApp or SMS statements to ${riderSummary.riderName}`}
      size="lg"
    >
      <div className="space-y-4">

        {/* Rider Badge Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">
              {riderSummary.riderName} ({riderSummary.feId})
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Phone className="h-3 w-3 text-emerald-500" />
              {riderSummary.phone}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-500">Pending:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {formatINR(riderSummary.outstandingBalance)}
            </span>
          </div>
        </div>

        {/* Body Content */}
        <div className="mt-4 space-y-4">
          {/* Channel and Template Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dispatch Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel('WhatsApp')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition ${
                    channel === 'WhatsApp'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <MessageCircle className="h-4 w-4 text-emerald-500" />
                  WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => setChannel('SMS')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition ${
                    channel === 'SMS'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="h-4 w-4 text-indigo-500" />
                  Direct SMS
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Message Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value as RiderMessageType)}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {MESSAGE_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.type} value={tmpl.type}>
                    {tmpl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Note input if Custom Template selected */}
          {selectedTemplate === 'Custom Message' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Custom Content / Instruction
              </label>
              <textarea
                rows={2}
                placeholder="Enter specific message details, bank details, or settlement cutoff time..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Generated Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Message Preview (Editable)
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {messageBody.length} characters
              </span>
            </div>
            <textarea
              rows={8}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-3 text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Disclaimer regarding actual delivery confirmation */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
            <strong>Delivery Audit Notice:</strong> Clicking Send opens the official WhatsApp Web/App
            interface. This event is logged in message history as &ldquo;Dispatched via WhatsApp Link&rdquo;.
            Actual read receipts and delivery confirmations depend on WhatsApp carrier networks.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="secondary"
            onClick={handleCopy}
            className="w-full sm:w-auto inline-flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Message</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>

            {channel === 'WhatsApp' ? (
              <Button
                variant="primary"
                onClick={handleSendWhatsApp}
                disabled={saving || !messageBody.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{saving ? 'Opening...' : 'Open in WhatsApp'}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSendSMS}
                disabled={saving || !messageBody.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-2"
              >
                <Smartphone className="h-4 w-4" />
                <span>{saving ? 'Preparing...' : 'Trigger SMS App'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
