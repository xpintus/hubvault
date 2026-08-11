import { Assignment } from './types';

export interface ODAShipment {
  awb: string;
  customerName: string;
  pincode: string;
  fullAddress: string;
  destinationCity: string;
  reason: string;
}

const key=(hubId:string)=>`hubvault-oda-shipments:${hubId}`;
const normalized=(value:string)=>value.toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
const originalValue=(original:Record<string,unknown>,aliases:string[])=>{const wanted=new Set(aliases.map(normalized));const entry=Object.entries(original).find(([name])=>wanted.has(normalized(name)));return String(entry?.[1]??'').trim();};

export function toODAShipments(assignments:Assignment[]):ODAShipment[]{
  return assignments.filter(item=>item.status==='Unassigned'&&item.reason==='Unassigned – No Matching Executive').map(({shipment,reason})=>({
    awb:shipment.awb,
    customerName:originalValue(shipment.original,['consignee name','customer name','recipient name','name']),
    pincode:shipment.pincode,
    fullAddress:originalValue(shipment.original,['consignee address','customer address','delivery address','destination address'])||shipment.locality,
    destinationCity:shipment.area,
    reason,
  }));
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
