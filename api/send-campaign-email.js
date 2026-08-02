const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vkawboukfltmebhpkuku.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const reply = (res, status, body) => { res.status(status).setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(body)); };
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const paragraphs = (value) => escapeHtml(value).split(/\n{2,}/).map((text) => `<p style="margin:0 0 16px;line-height:1.7;color:#475569">${text.replace(/\n/g, '<br>')}</p>`).join('');

const promotionalTemplate = (unsubscribe) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>HubVault</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:30px 0;"><tr><td align="center"><table width="650" cellpadding="0" cellspacing="0" style="width:100%;max-width:650px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">
<tr><td align="center" style="background:#0F172A;padding:40px;"><img src="https://raw.githubusercontent.com/xpintus/hubvault/main/public/favicon.ico" width="80" alt="HubVault Logo"><h1 style="color:#ffffff;margin:15px 0 5px;">🚀 HubVault</h1><p style="color:#CBD5E1;font-size:16px;margin:0;">Smart Collection Reconciliation Platform</p></td></tr>
<tr><td style="padding:40px;"><h2 style="margin-top:0;color:#111827;">💼 Simplify Your Daily Collection Management</h2><p style="font-size:16px;color:#4B5563;line-height:28px;">Managing COD collections, CMS deposits, cash handovers and reconciliation manually?<br><br><b>HubVault</b> helps Logistics, Courier, Warehouse and Last-Mile companies automate their daily collection process with complete accuracy.</p></td></tr>
<tr><td style="padding:0 40px 30px;"><h3 style="color:#111827;">✨ Powerful Features</h3><table width="100%" cellpadding="10" style="color:#374151;font-size:14px;"><tr><td>💰 Cash Collection Tracking</td><td>🏦 CMS Deposit Management</td></tr><tr><td>🧾 Cash Denomination Calculator</td><td>📊 Smart Reports</td></tr><tr><td>📈 Dues &amp; Advance Tracking</td><td>📤 Excel Export</td></tr><tr><td>🔐 Secure Cloud Backup</td><td>🌐 Multi Hub Support</td></tr><tr><td>📱 Mobile Friendly</td><td>⚡ Offline Support</td></tr></table></td></tr>
<tr><td style="padding:0 40px 30px;"><h3 style="color:#111827;">🎯 Why Choose HubVault?</h3><p style="line-height:30px;color:#4B5563;">✅ Save Hours Every Day<br>✅ Reduce Manual Errors<br>✅ Track Every Rupee<br>✅ Real-Time Reports<br>✅ Easy to Use Dashboard<br>✅ Better Financial Control</p></td></tr>
<tr><td align="center" style="padding:20px 40px 50px;"><a href="https://www.hubvault.in" style="background:#2563EB;color:white;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:18px;font-weight:bold;display:inline-block;">🚀 Visit HubVault</a><p style="margin-top:20px;color:#6B7280;font-size:15px;">🌐 www.hubvault.in</p></td></tr>
<tr><td align="center" style="background:#F9FAFB;padding:30px;"><p style="margin:0;font-size:14px;color:#6B7280;">Made for Logistics • Courier • Warehouse • E-commerce • Last Mile Operations</p><p style="margin-top:10px;color:#9CA3AF;font-size:13px;">© 2026 HubVault. All Rights Reserved.</p><p style="margin-top:14px;font-size:11px;"><a href="${unsubscribe}" style="color:#9CA3AF;">Unsubscribe from promotional emails</a></p></td></tr>
</table></td></tr></table></body></html>`;

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
    const unsubscribe = `mailto:hello@hubvault.in?subject=${encodeURIComponent(`Unsubscribe ${to}`)}`;
    const cta = ctaUrl && ctaLabel ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;margin-top:8px;padding:14px 24px;border-radius:12px;background:${accent};color:#fff;text-decoration:none;font-weight:800">${escapeHtml(ctaLabel)}</a>` : '';
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'HubVault <hello@hubvault.in>', to: [to], reply_to: 'hello@hubvault.in', subject,
        headers: { 'List-Unsubscribe': `<${unsubscribe}>` },
        text: `Hi ${recipientName || 'there'},\n\n${message}\n\n${ctaUrl ? `${ctaLabel}: ${ctaUrl}\n\n` : ''}HubVault — Smarter Collections. Stronger Control.\nUnsubscribe: ${unsubscribe}`,
        html: campaignType === 'promotion' ? promotionalTemplate(unsubscribe) : `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:28px 14px"><div style="overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.1)"><div style="padding:28px;background:linear-gradient(135deg,#17152f,${accent});color:#fff"><b style="font-size:20px">HubVault</b><div style="margin-top:18px;font-size:11px;font-weight:800;letter-spacing:1.6px;color:#a5f3fc">${badge}</div><h1 style="margin:8px 0 0;font-size:28px">${escapeHtml(subject)}</h1></div><div style="padding:30px"><p style="font-size:17px;font-weight:700">Hi ${escapeHtml(recipientName || 'there')},</p>${paragraphs(message)}${cta}<div style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">HubVault — Smarter Collections. Stronger Control.<br>Questions? Reply to this email.</div></div></div><p style="text-align:center;color:#94a3b8;font-size:11px">You received this business communication from HubVault.<br><a href="${unsubscribe}" style="color:#64748b">Unsubscribe</a></p></div></body></html>`,
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
