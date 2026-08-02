const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vkawboukfltmebhpkuku.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const reply = (res, status, body) => { res.status(status).setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(body)); };
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const paragraphs = (value) => escapeHtml(value).split(/\n{2,}/).map((text) => `<p style="margin:0 0 16px;line-height:1.7;color:#475569">${text.replace(/\n/g, '<br>')}</p>`).join('');

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { message: 'Method not allowed' });
  if (!process.env.RESEND_API_KEY || !SUPABASE_ANON_KEY) return reply(res, 500, { message: 'Email service is not configured' });
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return reply(res, 401, { message: 'Please log in again' });
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authorization, apikey: SUPABASE_ANON_KEY } });
    if (!userResponse.ok) return reply(res, 401, { message: 'Your session is invalid or expired' });
    const user = await userResponse.json();
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, { headers: { Authorization: authorization, apikey: SUPABASE_ANON_KEY } });
    const profiles = profileResponse.ok ? await profileResponse.json() : [];
    if (profiles?.[0]?.role !== 'super_admin') return reply(res, 403, { message: 'Only Super Admins can send campaign emails' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const to = String(body.to || '').trim().toLowerCase();
    const recipientName = String(body.recipientName || '').trim().slice(0, 100);
    const subject = String(body.subject || '').trim().slice(0, 150);
    const message = String(body.message || '').trim().slice(0, 5000);
    const ctaLabel = String(body.ctaLabel || '').trim().slice(0, 50);
    const ctaUrl = String(body.ctaUrl || '').trim();
    const campaignType = body.campaignType === 'promotion' ? 'promotion' : 'sales';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return reply(res, 400, { message: 'Enter a valid recipient email' });
    if (subject.length < 3 || message.length < 10) return reply(res, 400, { message: 'Subject and message are required' });
    if (ctaUrl && !/^https:\/\//i.test(ctaUrl)) return reply(res, 400, { message: 'CTA link must start with https://' });

    const accent = campaignType === 'promotion' ? '#7c3aed' : '#4f46e5';
    const badge = campaignType === 'promotion' ? 'SPECIAL OFFER' : 'HUBVAULT FOR YOUR BUSINESS';
    const unsubscribe = `mailto:billing@hubvault.in?subject=${encodeURIComponent(`Unsubscribe ${to}`)}`;
    const cta = ctaUrl && ctaLabel ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;margin-top:8px;padding:14px 24px;border-radius:12px;background:${accent};color:#fff;text-decoration:none;font-weight:800">${escapeHtml(ctaLabel)}</a>` : '';
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'HubVault <billing@hubvault.in>', to: [to], reply_to: 'billing@hubvault.in', subject,
        headers: { 'List-Unsubscribe': `<${unsubscribe}>` },
        text: `Hi ${recipientName || 'there'},\n\n${message}\n\n${ctaUrl ? `${ctaLabel}: ${ctaUrl}\n\n` : ''}HubVault — Smarter Collections. Stronger Control.\nUnsubscribe: ${unsubscribe}`,
        html: `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:28px 14px"><div style="overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.1)"><div style="padding:28px;background:linear-gradient(135deg,#17152f,${accent});color:#fff"><b style="font-size:20px">HubVault</b><div style="margin-top:18px;font-size:11px;font-weight:800;letter-spacing:1.6px;color:#a5f3fc">${badge}</div><h1 style="margin:8px 0 0;font-size:28px">${escapeHtml(subject)}</h1></div><div style="padding:30px"><p style="font-size:17px;font-weight:700">Hi ${escapeHtml(recipientName || 'there')},</p>${paragraphs(message)}${cta}<div style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">HubVault — Smarter Collections. Stronger Control.<br>Questions? Reply to this email.</div></div></div><p style="text-align:center;color:#94a3b8;font-size:11px">You received this business communication from HubVault.<br><a href="${unsubscribe}" style="color:#64748b">Unsubscribe</a></p></div></body></html>`,
      }),
    });
    const result = await resendResponse.json();
    if (!resendResponse.ok) return reply(res, resendResponse.status, { message: result.message || 'Resend could not send the email' });
    return reply(res, 200, { message: 'Campaign email sent successfully', id: result.id });
  } catch (error) {
    console.error('send-campaign-email:', error);
    return reply(res, 500, { message: error instanceof Error ? error.message : 'Could not send email' });
  }
}
