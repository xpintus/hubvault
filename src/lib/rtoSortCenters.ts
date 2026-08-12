import { supabase } from '@/lib/supabase';
export interface RTOSortCenter { id:string; hubId:string; name:string; toEmail:string; ccEmail:string }
interface Row { id:string; hub_id:string; name:string; to_email:string; cc_email:string|null }
const map=(row:Row):RTOSortCenter=>({id:row.id,hubId:row.hub_id,name:row.name,toEmail:row.to_email,ccEmail:row.cc_email??''});
export async function loadRTOSortCenters(hubId:string){if(!hubId||hubId==='all')return[];const{data,error}=await supabase.from('rto_sort_centers').select('id,hub_id,name,to_email,cc_email').eq('hub_id',hubId).order('name');if(error)throw error;return((data??[])as Row[]).map(map);}
export async function upsertRTOSortCenter(input:{id?:string;hubId:string;name:string;toEmail:string;ccEmail:string}){const payload={hub_id:input.hubId,name:input.name.trim(),to_email:input.toEmail.trim(),cc_email:input.ccEmail.trim()||null,updated_at:new Date().toISOString()};const query=input.id?supabase.from('rto_sort_centers').update(payload).eq('id',input.id):supabase.from('rto_sort_centers').insert(payload);const{data,error}=await query.select('id,hub_id,name,to_email,cc_email').single();if(error)throw error;return map(data as Row);}
export async function deleteRTOSortCenter(id:string){const{error}=await supabase.from('rto_sort_centers').delete().eq('id',id);if(error)throw error;}
