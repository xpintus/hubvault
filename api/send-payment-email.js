const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  'https://vkawboukfltmebhpkuku.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

const PAYMENT_AMOUNT = '999';
const UPI_ID = 'BHARATPE09899107906@yesbankltd';

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
    return sendJson(res, 405, {
      message: 'Method not allowed',
    });
  }

  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return sendJson(res, 500, {
        message: 'RESEND_API_KEY is not configured in Vercel',
      });
    }

    const authorization = req.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return sendJson(res, 401, {
        message: 'Please log in again',
      });
    }

    if (SUPABASE_ANON_KEY) {
      const userResponse = await fetch(
        `${SUPABASE_URL}/auth/v1/user`,
        {
          headers: {
            Authorization: authorization,
            apikey: SUPABASE_ANON_KEY,
          },
        }
      );

      if (!userResponse.ok) {
        return sendJson(res, 401, {
          message: 'Your login session is invalid or expired',
        });
      }
    }

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || 'Not provided').trim();
    const company = String(body.company || 'Not provided').trim();

    const date = String(
      body.date ||
        new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        })
    ).trim();

    if (!name || !email) {
      return sendJson(res, 400, {
        message: 'Customer name and email are required',
      });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeCompany = escapeHtml(company);
    const safeDate = escapeHtml(date);

    const resendResponse = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          from: 'HubVault Billing <billing@hubvault.in>',
          to: [email],
          reply_to: 'billing@hubvault.in',

          subject:
            '🎉 Your HubVault Purchase Request Has Been Received – Complete ₹999 Payment to Activate Your HubVault License 🚀',

          html: `
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HubVault Purchase Request</title>
</head>

<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  bgcolor="#f4f7fb"
  role="presentation"
>
<tr>
<td align="center" style="padding:30px 10px;">

<table
  width="650"
  cellpadding="0"
  cellspacing="0"
  bgcolor="#ffffff"
  role="presentation"
  style="width:100%;max-width:650px;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);"
>

<!-- Logo -->
<tr>
<td align="center" style="padding:30px 20px 15px;">

<img
  src="https://hubvault.in/logo.png"
  width="240"
  alt="HubVault"
  style="display:block;max-width:100%;height:auto;"
>

</td>
</tr>

<!-- Hero Banner -->
<tr>
<td>

<img
  src="https://hubvault.in/og-image-v2.jpg"
  width="650"
  alt="HubVault"
  style="display:block;width:100%;max-width:650px;height:auto;"
>

</td>
</tr>

<!-- Main Content -->
<tr>
<td style="padding:40px 32px;">

<h2 style="margin:0;color:#1e3a8a;font-size:24px;line-height:32px;">
👋 Hi ${safeName},
</h2>

<p style="font-size:16px;color:#555;line-height:28px;margin:18px 0 0;">
Thank you for choosing
<b style="color:#2563eb;">HubVault</b> 🚀
</p>

<p style="font-size:16px;color:#555;line-height:28px;margin:14px 0 0;">
We've successfully received your purchase request.
To activate your HubVault subscription, please complete the payment below.
</p>

<!-- Purchase Details -->
<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  role="presentation"
  style="margin:25px 0;background:#f8fbff;border:1px solid #dbeafe;border-radius:12px;"
>
<tr>
<td style="padding:20px;font-size:15px;color:#444;line-height:28px;">

<b style="font-size:17px;">📋 Purchase Details</b>
<br><br>

👤 <b>Name:</b> ${safeName}<br>
📧 <b>Email:</b> ${safeEmail}<br>
📱 <b>Mobile:</b> ${safePhone}<br>
🏢 <b>Company/Hub:</b> ${safeCompany}<br>
💰 <b>Subscription Amount:</b> ₹${PAYMENT_AMOUNT}<br>
📅 <b>Date:</b> ${safeDate}

</td>
</tr>
</table>

<h3 style="color:#2563eb;margin:0 0 10px;font-size:20px;">
💳 Complete Your Payment
</h3>

<p style="font-size:16px;color:#555;line-height:28px;margin:0 0 18px;">
Please pay
<b style="color:#16a34a;font-size:18px;">₹${PAYMENT_AMOUNT}</b>
using the payment button below or scan the QR Code.
</p>

<!-- Payment Box -->
<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  role="presentation"
  style="background:#eef5ff;border-left:5px solid #2563eb;border-radius:12px;"
>
<tr>
<td align="center" style="padding:24px;">

<div style="font-size:15px;color:#666;">
Total Payable Amount
</div>

<div style="font-size:36px;font-weight:bold;color:#16a34a;margin:8px 0 20px;">
₹${PAYMENT_AMOUNT}
</div>

<div style="font-size:15px;color:#666;">
UPI ID
</div>

<div style="font-size:20px;font-weight:bold;color:#2563eb;margin-top:8px;word-break:break-all;">
${UPI_ID}
</div>

</td>
</tr>
</table>

<!-- Pay Now Button -->
<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  role="presentation"
  style="margin:28px 0 12px;"
>
<tr>
<td align="center">

<a
  href="https://www.hubvault.in/#/payment"
  target="_blank"
  rel="noopener noreferrer"
  style="display:inline-block;background:#2563eb;color:#ffffff;padding:16px 38px;font-size:18px;font-weight:bold;text-decoration:none;border-radius:10px;box-shadow:0 6px 14px rgba(37,99,235,.25);"
>
💳 Pay ₹${PAYMENT_AMOUNT} Now
</a>

</td>
</tr>
</table>

<p align="center" style="font-size:13px;color:#64748b;margin:0 0 25px;">
Click the button above to open the secure HubVault payment page.
</p>

<!-- QR Code -->
<p align="center" style="margin:20px 0 10px;">

<img
  src="https://hubvault.in/ChatGPT_Image_Jul_28,_2026,_11_30_59_PM.png"
  width="220"
  alt="Payment QR Code"
  style="display:inline-block;max-width:100%;height:auto;border-radius:12px;border:1px solid #ddd;"
>

</p>

<p align="center" style="font-size:14px;color:#666;margin:0;">
📱 Scan this QR Code using any UPI App.
</p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:35px 0;">

<!-- Next Steps -->
<h3 style="color:#16a34a;margin:0 0 12px;font-size:20px;">
✅ What Happens Next?
</h3>

<p style="font-size:16px;color:#555;line-height:32px;margin:0;">

📩 Reply to this email with your
<b>Payment Screenshot</b> or <b>UTR Number</b>.<br>

🔍 Our team will verify your payment.<br>

🔑 After successful verification, we'll send your unique
<b>HubVault License Code</b>.<br>

🚀 Enter the License Code in HubVault to activate your subscription instantly.

</p>

<!-- Welcome Box -->
<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  role="presentation"
  style="background:#edfdf5;border-radius:12px;margin-top:35px;"
>
<tr>
<td align="center" style="padding:22px;">

<h3 style="margin:0;color:#0f766e;font-size:20px;">
🎉 Welcome to HubVault
</h3>

<p style="font-size:15px;color:#555;line-height:28px;margin:12px 0 0;">
Thank you for trusting HubVault.
We're excited to help automate your Collection Reconciliation
and simplify your logistics operations.
</p>

</td>
</tr>
</table>

<p style="margin-top:35px;font-size:16px;color:#555;line-height:28px;">
Need help?<br>
Simply reply to this email and our billing team will be happy to assist you. 💙
</p>

<p style="margin-top:40px;font-size:16px;color:#555;line-height:28px;">

Regards,<br><br>

<b style="font-size:20px;color:#2563eb;">
🚀 HubVault Billing Team
</b>

<br>

🌐
<a
  href="https://hubvault.in"
  style="color:#2563eb;text-decoration:none;"
>
hubvault.in
</a>

<br>

📧
<a
  href="mailto:billing@hubvault.in"
  style="color:#2563eb;text-decoration:none;"
>
billing@hubvault.in
</a>

</p>

</td>
</tr>

<!-- Footer -->
<tr bgcolor="#0f172a">
<td
  align="center"
  style="padding:30px 24px;color:#cbd5e1;font-size:14px;line-height:26px;"
>

<b style="font-size:20px;color:#ffffff;">
Smarter Collections. Stronger Control.
</b>

<br><br>

Cash &amp; COD Tracking • Online Payment Reconciliation •
Multi-Hub Management • Smart Reports • Secure &amp; Reliable

<br><br>

© 2026 HubVault. All Rights Reserved.

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`,
        }),
      }
    );

    const result = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', result);

      return sendJson(res, resendResponse.status, {
        message: result?.message || 'Email could not be sent',
      });
    }

    return sendJson(res, 200, {
      message: 'Payment email sent successfully',
      id: result.id,
    });
  } catch (error) {
    console.error('send-payment-email:', error);

    return sendJson(res, 500, {
      message:
        error instanceof Error
          ? error.message
          : 'Email sending failed',
    });
  }
}
