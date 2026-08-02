const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vkawboukfltmebhpkuku.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const reply = (res,status,body) => { res.status(status).setHeader('Content-Type','application/json'); return res.end(JSON.stringify(body)); };
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[char]);

async function supabaseGet(path,authorization) {
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{Authorization:authorization,apikey:SUPABASE_ANON_KEY}});
  return response.ok ? response.json() : [];
}

export default async function handler(req,res){
  if(req.method!=='POST')return reply(res,405,{message:'Method not allowed'});
  if(!process.env.RESEND_API_KEY||!SUPABASE_ANON_KEY)return reply(res,500,{message:'Email service is not configured'});
  try{
    const authorization=req.headers.authorization;
    if(!authorization?.startsWith('Bearer '))return reply(res,401,{message:'Please log in again'});
    const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:SUPABASE_ANON_KEY}});
    if(!userResponse.ok)return reply(res,401,{message:'Your session is invalid or expired'});
    const user=await userResponse.json();
    const profiles=await supabaseGet(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,authorization);
    if(profiles?.[0]?.role!=='super_admin')return reply(res,403,{message:'Only Super Admins can send license emails'});

    const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
    const requestId=String(body.request_id||'').trim();
    if(!/^[0-9a-f-]{36}$/i.test(requestId))return reply(res,400,{message:'Invalid payment request'});
    const requests=await supabaseGet(`license_payment_requests?id=eq.${encodeURIComponent(requestId)}&select=user_id,status,license_code,request_type`,authorization);
    const payment=requests?.[0];
    if(!payment||payment.status!=='verified'||!payment.license_code||payment.request_type==='hub_add')return reply(res,400,{message:'A verified license payment with a license code is required'});
    const buyers=await supabaseGet(`profiles?id=eq.${encodeURIComponent(payment.user_id)}&select=name,email`,authorization);
    const buyer=buyers?.[0];
    if(!buyer?.email)return reply(res,404,{message:'Buyer email was not found'});

    const name=escapeHtml(buyer.name||'Valued Customer');
    const code=escapeHtml(payment.license_code);
    const dashboardUrl='https://www.hubvault.in/#/dashboard';
    const resendResponse=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({
      from:'HubVault <hello@hubvault.in>',to:[buyer.email],reply_to:'hello@hubvault.in',subject:'🎉 Your HubVault License Is Ready — Activate Your Account',
      text:`Hello ${buyer.name||'Valued Customer'},\n\nThank you for choosing HubVault. We have received and verified your payment.\n\nYour license code: ${payment.license_code}\n\nOpen your dashboard: ${dashboardUrl}\nEnter the code in the license activation window. Please keep this code private.\n\nWelcome to HubVault!`,
      html:`<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 12px"><tr><td align="center"><table width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08)"><tr><td style="padding:36px;text-align:center;background:linear-gradient(135deg,#0f172a,#4f46e5);color:#fff"><div style="font-size:30px">🎉</div><h1 style="margin:12px 0 6px;font-size:28px">Welcome to HubVault!</h1><p style="margin:0;color:#cbd5e1">Your payment has been verified successfully</p></td></tr><tr><td style="padding:36px;color:#475569"><p style="font-size:17px;color:#111827;font-weight:700">Hello ${name},</p><p style="font-size:15px;line-height:26px">Thank you for choosing HubVault. Your payment has been received and verified. Your lifetime license is now ready for activation.</p><div style="margin:26px 0;padding:22px;text-align:center;background:#eef2ff;border:1px dashed #6366f1;border-radius:14px"><div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#6366f1">YOUR LICENSE CODE</div><div style="margin-top:10px;font-family:monospace;font-size:24px;font-weight:900;letter-spacing:2px;color:#1e1b4b;word-break:break-all">${code}</div></div><div style="padding:18px;background:#f8fafc;border-radius:12px;font-size:14px;line-height:25px"><b style="color:#111827">How to activate:</b><br>1. Open your HubVault dashboard.<br>2. Click “Activate Now”.<br>3. Enter the license code shown above.</div><div style="text-align:center;margin-top:26px"><a href="${dashboardUrl}" style="display:inline-block;padding:15px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:11px;font-weight:800">Open HubVault Dashboard →</a></div><p style="margin-top:28px;font-size:12px;line-height:20px;color:#94a3b8">Keep this license code private. If you need help, simply reply to this email.</p></td></tr><tr><td style="padding:24px;text-align:center;background:#0f172a;color:#94a3b8;font-size:12px">HubVault — Smarter Collections. Stronger Control.<br>© 2026 HubVault. All Rights Reserved.</td></tr></table></td></tr></table></body></html>`
    })});
    const result=await resendResponse.json();
    if(!resendResponse.ok)return reply(res,resendResponse.status,{message:result.message||'Resend could not send the license email'});
    return reply(res,200,{message:`License email sent to ${buyer.email}`,id:result.id});
  }catch(error){console.error('send-license-email:',error);return reply(res,500,{message:error instanceof Error?error.message:'Could not send license email'});}
}
