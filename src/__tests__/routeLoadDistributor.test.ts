import { describe,expect,it } from 'vitest';
import { distributeShipments } from '@/lib/routeLoad/engine';
import { validateRows } from '@/lib/routeLoad/parser';
import { DistributionSettings,Executive,Shipment } from '@/lib/routeLoad/types';

const exec=(id:string,capacity=100,extra:Partial<Executive>={}):Executive=>({id,name:id,employeeId:id,route:'',area:'',pincodes:[],maxCapacity:capacity,pendingLoad:0,vehicle:'Bike',active:true,...extra});
const shipment=(i:number,extra:Partial<Shipment>={}):Shipment=>({id:`s${i}`,awb:`AWB${i}`,pincode:'',area:'',route:'',locality:'',priority:'Normal',paymentType:'Prepaid',codAmount:0,weight:0,currentStatus:'',sourceRow:i,original:{awb:`AWB${i}`},...extra});
const settings=(extra:Partial<DistributionSettings>={}):DistributionSettings=>({method:'equal',balanceCod:false,considerWeight:false,useLocationRules:false,...extra});
const run=(count:number,executives:Executive[],s:DistributionSettings=settings())=>distributeShipments(Array.from({length:count},(_,i)=>shipment(i+1)),executives,s);
const invariant=(r:ReturnType<typeof run>)=>{expect(r.assigned+r.unassigned).toBe(r.total);expect(new Set(r.assignments.map(a=>a.shipment.awb)).size).toBe(r.total);r.executiveResults.forEach(x=>expect(x.newLoad).toBeLessThanOrEqual(Math.max(0,x.executive.maxCapacity-x.executive.pendingLoad)));};

describe('Route Load Distributor engine',()=>{
  it('distributes 103 shipments as 21, 21, 21, 20, 20',()=>{const r=run(103,[1,2,3,4,5].map(i=>exec(`E${i}`,40)));expect(r.executiveResults.map(x=>x.newLoad)).toEqual([21,21,21,20,20]);invariant(r);});
  it('handles more executives than shipments',()=>{const r=run(2,[1,2,3,4].map(i=>exec(`E${i}`)));expect(r.executiveResults.map(x=>x.newLoad)).toEqual([1,1,0,0]);invariant(r);});
  it('leaves shipments unassigned when total capacity is insufficient',()=>{const r=run(7,[exec('A',2),exec('B',3)]);expect(r.assigned).toBe(5);expect(r.unassigned).toBe(2);invariant(r);});
  it('never assigns an unavailable executive',()=>{const r=run(4,[exec('A',10,{active:false}),exec('B')]);expect(r.executiveResults[0].newLoad).toBe(0);expect(r.executiveResults[1].newLoad).toBe(4);});
  it('subtracts pending load from capacity',()=>{const r=run(5,[exec('A',5,{pendingLoad:4}),exec('B',5)]);expect(r.executiveResults[0].newLoad).toBe(1);invariant(r);});
  it('matches pincode before other rules',()=>{const r=distributeShipments([shipment(1,{pincode:'851101',route:'R2'})],[exec('Pin',5,{pincodes:['851101']}),exec('Route',5,{route:'R2'})],settings({useLocationRules:true}));expect(r.assignments[0].executiveId).toBe('Pin');expect(r.assignments[0].reason).toBe('Matched by Pincode');});
  it('falls back to route',()=>{const r=distributeShipments([shipment(1,{route:'BGU-02'})],[exec('Route',5,{route:'BGU-02'})],settings({useLocationRules:true}));expect(r.assignments[0].reason).toBe('Matched by Route');});
  it('falls back to area',()=>{const r=distributeShipments([shipment(1,{area:'Begusarai Town'})],[exec('Area',5,{area:'Begusarai Town'})],settings({useLocationRules:true}));expect(r.assignments[0].reason).toBe('Matched by Area');});
  it('shows no matching executive as unassigned',()=>{const r=distributeShipments([shipment(1,{pincode:'999999'})],[exec('A',5,{pincodes:['851101']})],settings({useLocationRules:true}));expect(r.unassigned).toBe(1);expect(r.assignments[0].reason).toBe('Unassigned – No Matching Executive');});
  it('processes higher priorities first',()=>{const r=distributeShipments([shipment(1,{priority:'Low'}),shipment(2,{priority:'Urgent'}),shipment(3,{priority:'High'})],[exec('A',2)],settings({method:'priority'}));expect(r.assignments.slice(0,2).map(a=>a.shipment.priority)).toEqual(['Urgent','High']);expect(r.assignments[2].status).toBe('Unassigned');});
  it('respects maximum COD limit',()=>{const r=distributeShipments([shipment(1,{codAmount:80}),shipment(2,{codAmount:30})],[exec('A',5,{maxCodAmount:100})],settings({balanceCod:true}));expect(r.assigned).toBe(1);expect(r.assignments[1].reason).toBe('Unassigned – COD Limit');});
  it('respects maximum weight limit',()=>{const r=distributeShipments([shipment(1,{weight:8}),shipment(2,{weight:4})],[exec('A',5,{maxWeight:10})],settings({considerWeight:true}));expect(r.assigned).toBe(1);expect(r.assignments[1].reason).toBe('Unassigned – Weight Limit');});
  it('prevents duplicate AWB records',()=>{const checked=validateRows([{AWB:'ONE'},{AWB:'ONE'},{AWB:''}],{awb:'AWB'});expect(checked.valid).toHaveLength(1);expect(checked.invalid.map(x=>x.reason)).toEqual(['Duplicate AWB','Blank AWB']);const r=distributeShipments([shipment(1),{...shipment(2),awb:'AWB1'}],[exec('A')],settings());expect(r.total).toBe(1);});
  it('detects the HubVault transport report customer destination columns',async()=>{const {suggestColumns}=await import('@/lib/routeLoad/parser');const mapping=suggestColumns(['AWB','Bag ID','Seller Pincode','Customer City','Customer Pincode','Total Amount']);expect(mapping).toMatchObject({awb:'AWB',area:'Customer City',pincode:'Customer Pincode'});expect(mapping.codAmount).toBeUndefined();});
  it('is deterministic with identical input',()=>{const input=Array.from({length:20},(_,i)=>shipment(i));const team=[exec('A'),exec('B'),exec('C')];expect(distributeShipments(input,team,settings()).assignments).toEqual(distributeShipments(input,team,settings()).assignments);});
  it('accounts for every unique valid shipment exactly once without mutating originals',()=>{const input=Array.from({length:30},(_,i)=>shipment(i));const snapshot=structuredClone(input);const r=distributeShipments(input,[exec('A',4),exec('B',7)],settings());invariant(r);expect(input).toEqual(snapshot);expect(r.total).toBe(30);});
  it('allocates capacity-based loads proportionally in balanced rounds',()=>{const r=run(120,[exec('A',20),exec('B',40),exec('C',60)],settings({method:'capacity'}));expect(r.executiveResults.map(x=>x.newLoad)).toEqual([20,40,60]);invariant(r);});
});
