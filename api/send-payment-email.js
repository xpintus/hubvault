const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vkawboukfltmebhpkuku.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return sendJson(res, 500, { message: 'RESEND_API_KEY is not configured in Vercel' });
    }

    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return sendJson(res, 401, { message: 'Please log in again' });
    }

    if (SUPABASE_ANON_KEY) {
      const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: authorization,
          apikey: SUPABASE_ANON_KEY,
        },
      });

      if (!userResponse.ok) {
        return sendJson(res, 401, { message: 'Your login session is invalid or expired' });
      }
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || 'Not provided').trim();
    const company = String(body.company || 'Not provided').trim();
    const date = String(body.date || new Date().toLocaleString('en-IN')).trim();

    if (!name || !email) {
      return sendJson(res, 400, { message: 'Customer name and email are required' });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeCompany = escapeHtml(company);
    const safeDate = escapeHtml(date);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HubVault <support@hubvault.in>',
        to: [email],
        reply_to: 'support@hubvault.in',
        subject: 'Complete Your HubVault Payment',
        html: `<!doctype html>
<html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#334155">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:24px 10px"><tr><td align="center">
<table width="650" cellpadding="0" cellspacing="0" style="width:100%;max-width:650px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="padding:24px"><img src="https://hubvault.in/logo.png" width="210" alt="HubVault" style="max-width:100%;height:auto"></td></tr>
<tr><td><img src="https://hubvault.in/og-image-v2.jpg" width="650" alt="HubVault" style="display:block;width:100%;height:auto"></td></tr>
<tr><td style="padding:32px">
<h2 style="margin:0 0 18px;color:#1d4ed8">Hi ${safeName},</h2>
<p style="font-size:16px;line-height:1.7">Thank you for choosing <strong>HubVault</strong>. We received your purchase request. Complete the payment below to receive your License Code.</p>
<div style="margin:22px 0;padding:18px;background:#eff6ff;border:1px solid #dbeafe;border-radius:12px;line-height:1.9">
<strong>Purchase Details</strong><br>Name: ${safeName}<br>Email: ${safeEmail}<br>Mobile: ${safePhone}<br>Company/Hub: ${safeCompany}<br>Date: ${safeDate}
</div>
<h3 style="color:#1d4ed8">Payment Details</h3>
<div style="padding:18px;text-align:center;background:#eff6ff;border-radius:12px"><small>UPI ID</small><br><strong style="font-size:18px;color:#1d4ed8;word-break:break-all">BHARATPE09899107906@yesbankltd</strong></div>
<div style="text-align:center;margin:24px 0"><img src="https://hubvault.in/ChatGPT_Image_Jul_28,_2026,_11_30_59_PM.png" width="220" alt="Payment QR" style="max-width:100%;border-radius:12px;border:1px solid #e2e8f0"></div>
<p style="font-size:16px;line-height:1.8">After payment, reply with the payment screenshot or UTR number. After verification, your HubVault License Code will be emailed to you.</p>
<p style="margin-top:28px">Regards,<br><strong style="color:#1d4ed8">HubVault Team</strong><br>hubvault.in</p>
</td></tr>
<tr><td align="center" style="padding:22px;background:#0f172a;color:#cbd5e1">Smarter Collections. Stronger Control.<br>© 2026 HubVault</td></tr>
</table></td></tr></table>
</body></html>`,
      }),
    });

    const result = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Resend error:', result);
      return sendJson(res, resendResponse.status, {
        message: result?.message || 'Email could not be sent',
      });
    }

    return sendJson(res, 200, { message: 'Payment email sent successfully', id: result.id });
  } catch (error) {
    console.error('send-payment-email:', error);
    return sendJson(res, 500, {
      message: error instanceof Error ? error.message : 'Email sending failed',
    });
  }
}
