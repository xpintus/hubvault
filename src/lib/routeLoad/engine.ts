import { Assignment, AssignmentReason, DistributionResult, DistributionSettings, Executive, ExecutiveResult, Priority, Shipment } from './types';

const PRIORITY: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const norm = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
export const availableCapacity = (e: Executive) => Math.max(0, Math.floor(e.maxCapacity) - Math.max(0, Math.floor(e.pendingLoad)));

function resultFor(executives: Executive[], assignments: Assignment[]): DistributionResult {
  const executiveResults: ExecutiveResult[] = executives.map(executive => {
    const mine = assignments.filter(item => item.executiveId === executive.id); const newLoad = mine.length;
    const finalLoad = executive.pendingLoad + newLoad; const utilization = executive.maxCapacity > 0 ? finalLoad / executive.maxCapacity * 100 : 0;
    return { executive, assignments: mine, newLoad, finalLoad, codAmount: mine.reduce((n,a)=>n+a.shipment.codAmount,0), weight: mine.reduce((n,a)=>n+a.shipment.weight,0), utilization, status: executive.pendingLoad > executive.maxCapacity ? 'Overloaded' : utilization >= 100 ? 'Full' : utilization >= 85 ? 'Near Capacity' : 'Balanced' };
  });
  const assigned = assignments.filter(a=>a.status==='Assigned').length; const totalCapacity = executives.filter(e=>e.active).reduce((n,e)=>n+availableCapacity(e),0);
  return { assignments, executiveResults, total: assignments.length, assigned, unassigned: assignments.length-assigned, totalCapacity, totalCod: assignments.reduce((n,a)=>n+a.shipment.codAmount,0), utilization: totalCapacity ? assigned/totalCapacity*100 : 0 };
}

function locationMatch(s: Shipment, e: Executive): { rank: number; reason: AssignmentReason } | null {
  const employeeAreas=(e.areas?.length?e.areas:e.area.split(',')).map(norm).filter(Boolean);
  const addressArea=norm(`${s.area} ${s.locality}`);
  if(employeeAreas.some(area=>` ${addressArea} `.includes(` ${area} `))) return { rank: 0, reason: 'Matched by Area' };
  if (s.pincode && e.pincodes.some(p => norm(p) === norm(s.pincode))) return { rank: 1, reason: 'Matched by Pincode' };
  if (s.route && e.route && norm(s.route) === norm(e.route)) return { rank: 2, reason: 'Matched by Route' };
  return null;
}

export function distributeShipments(shipments: Shipment[], executives: Executive[], settings: DistributionSettings): DistributionResult {
  const unique = new Map<string,Shipment>(); shipments.forEach(s => { if (!unique.has(norm(s.awb))) unique.set(norm(s.awb),s); });
  const ordered = [...unique.values()].sort((a,b) => settings.method === 'priority' ? PRIORITY[a.priority]-PRIORITY[b.priority] || a.sourceRow-b.sourceRow : a.sourceRow-b.sourceRow);
  const active = executives.filter(e=>e.active && availableCapacity(e)>0);
  const state = new Map(active.map(e=>[e.id,{ count:0,cod:0,weight:0 }])); const assignments: Assignment[]=[];
  for (const shipment of ordered) {
    const candidates = active.map(executive => ({ executive, match: settings.useLocationRules ? locationMatch(shipment,executive) : null })).filter(({executive,match}) => {
      const current=state.get(executive.id)!; if(current.count>=availableCapacity(executive)) return false;
      if(settings.balanceCod && executive.maxCodAmount!=null && current.cod+shipment.codAmount>executive.maxCodAmount) return false;
      if(settings.considerWeight && executive.maxWeight!=null && current.weight+shipment.weight>executive.maxWeight) return false;
      return !settings.useLocationRules || match !== null;
    });
    if (candidates.length) {
      candidates.sort((a,b) => {
        if ((a.match?.rank??9)!==(b.match?.rank??9)) return (a.match?.rank??9)-(b.match?.rank??9);
        const sa=state.get(a.executive.id)!,sb=state.get(b.executive.id)!;
        if(settings.balanceCod && sa.cod!==sb.cod) return sa.cod-sb.cod;
        if(settings.method==='capacity') { const ar=sa.count/availableCapacity(a.executive),br=sb.count/availableCapacity(b.executive); if(ar!==br)return ar-br; }
        const al=(a.executive.pendingLoad+sa.count)/Math.max(1,a.executive.maxCapacity),bl=(b.executive.pendingLoad+sb.count)/Math.max(1,b.executive.maxCapacity); return al-bl || executives.indexOf(a.executive)-executives.indexOf(b.executive);
      });
      const chosen=candidates[0], current=state.get(chosen.executive.id)!; current.count++;current.cod+=shipment.codAmount;current.weight+=shipment.weight;
      assignments.push({shipment,executiveId:chosen.executive.id,status:'Assigned',reason:chosen.match?.reason ?? (settings.method==='equal'?'Equal Distribution':settings.method==='priority'?'Priority Distribution':'Balanced by Capacity')});
    } else {
      const potential=active.filter(e=>!settings.useLocationRules||locationMatch(shipment,e)); let reason:AssignmentReason='Unassigned – No Matching Executive';
      if(potential.length){ if(potential.every(e=>state.get(e.id)!.count>=availableCapacity(e)))reason='Unassigned – Capacity Full'; else if(settings.balanceCod)reason='Unassigned – COD Limit'; else if(settings.considerWeight)reason='Unassigned – Weight Limit'; }
      assignments.push({shipment,executiveId:null,status:'Unassigned',reason});
    }
  }
  return resultFor(executives,assignments);
}

export function rebuildResult(executives: Executive[], assignments: Assignment[]) { return resultFor(executives, assignments); }

export function canReassign(assignment: Assignment, executive: Executive, all: Assignment[], settings: DistributionSettings): string | null {
  const mine=all.filter(a=>a.executiveId===executive.id && a.shipment.awb!==assignment.shipment.awb);
  if(!executive.active)return 'Executive is unavailable.'; if(mine.length>=availableCapacity(executive))return 'Executive capacity is full.';
  if(settings.balanceCod && executive.maxCodAmount!=null && mine.reduce((n,a)=>n+a.shipment.codAmount,0)+assignment.shipment.codAmount>executive.maxCodAmount)return 'COD limit would be exceeded.';
  if(settings.considerWeight && executive.maxWeight!=null && mine.reduce((n,a)=>n+a.shipment.weight,0)+assignment.shipment.weight>executive.maxWeight)return 'Weight limit would be exceeded.'; return null;
}
