import { Assignment } from './types';

export interface ODAShipment {
  awb: string;
  customerName: string;
  pincode: string;
  fullAddress: string;
  destinationCity: string;
  reason: string;
  suggestedArea?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  assignedAt?: string;
}

const key=(hubId:string)=>`hubvault-oda-shipments:${hubId}`;
const normalized=(value:string)=>value.toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
const originalValue=(original:Record<string,unknown>,aliases:string[])=>{const wanted=new Set(aliases.map(normalized));const entry=Object.entries(original).find(([name])=>wanted.has(normalized(name)));return String(entry?.[1]??'').trim();};
const genericAreaWords=new Set(['road','rd','district','near','beside','behind','opposite','front','ward','house','building','school','hospital','mandir','masjid','chowk','chouk']);
export function suggestArea(address:string,city=''){
  const segments=address.split(/[,;/]+/).map(value=>value.trim()).filter(Boolean).filter(value=>normalized(value)!==normalized(city)&&!normalized(value).includes('district'));
  const concise=segments.find(value=>{const words=normalized(value).split(' ').filter(Boolean);return words.length<=3&&!words.every(word=>genericAreaWords.has(word)||/^\d+$/.test(word));});
  const source=concise??segments[0]??address;
  return source.split(/\s+/).filter(word=>word&&!genericAreaWords.has(normalized(word))&&!/^\d+$/.test(word)).slice(0,3).join(' ').trim();
}

export function toODAShipments(assignments:Assignment[]):ODAShipment[]{
  return assignments.filter(item=>item.status==='Unassigned'&&item.reason==='Unassigned – No Matching Executive').map(({shipment,reason})=>{const fullAddress=originalValue(shipment.original,['consignee address','customer address','delivery address','destination address'])||shipment.locality;return{
    awb:shipment.awb,
    customerName:originalValue(shipment.original,['consignee name','customer name','recipient name','name']),
    pincode:shipment.pincode,
    fullAddress,
    destinationCity:shipment.area,
    reason,
    suggestedArea:suggestArea(fullAddress,shipment.area),
  };});
}

export function saveODAShipments(hubId:string,assignments:Assignment[]){
  if(typeof window==='undefined'||!hubId)return;
  localStorage.setItem(key(hubId),JSON.stringify({updatedAt:new Date().toISOString(),shipments:toODAShipments(assignments)}));
  window.dispatchEvent(new CustomEvent('hubvault:oda-updated',{detail:{hubId}}));
}

export function loadODAShipments(hubId:string):{updatedAt:string;shipments:ODAShipment[]}{
  if(typeof window==='undefined'||!hubId)return{updatedAt:'',shipments:[]};
  try{return JSON.parse(localStorage.getItem(key(hubId))??'') as {updatedAt:string;shipments:ODAShipment[]};}catch{return{updatedAt:'',shipments:[]};}
}

export function clearODAShipments(hubId:string){
  if(typeof window==='undefined'||!hubId)return;
  localStorage.removeItem(key(hubId));
  window.dispatchEvent(new CustomEvent('hubvault:oda-updated',{detail:{hubId}}));
}

export function markODAAssigned(hubId:string,awb:string,employee:{id:string;name:string},area:string){
  const current=loadODAShipments(hubId);const assignedAt=new Date().toISOString();
  const shipments=current.shipments.map(row=>row.awb===awb?{...row,suggestedArea:area,assignedEmployeeId:employee.id,assignedEmployeeName:employee.name,assignedAt}:row);
  localStorage.setItem(key(hubId),JSON.stringify({...current,shipments}));
  window.dispatchEvent(new CustomEvent('hubvault:oda-updated',{detail:{hubId}}));
  window.dispatchEvent(new CustomEvent('hubvault:oda-assigned',{detail:{hubId,awb,employeeId:employee.id,employeeName:employee.name,area}}));
}
