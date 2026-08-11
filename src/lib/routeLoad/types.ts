export type DistributionMethod = 'equal' | 'capacity' | 'priority';
export type VehicleType = 'Bike' | 'Cycle' | 'EV' | 'Van' | 'Walking' | 'Other';
export type Priority = 'Urgent' | 'High' | 'Normal' | 'Low';

export interface Shipment {
  id: string; awb: string; pincode: string; area: string; route: string; locality: string;
  priority: Priority; paymentType: string; codAmount: number; weight: number; currentStatus: string;
  sourceRow: number; original: Record<string, unknown>;
}
export interface InvalidShipmentRow { row: number; reason: string; original: Record<string, unknown>; awb?: string }
export interface Executive {
  id: string; name: string; employeeId: string; route: string; area: string; areas?: string[]; pincodes: string[];
  maxCapacity: number; pendingLoad: number; vehicle: VehicleType; active: boolean;
  maxCodAmount?: number; maxWeight?: number; locked?: boolean;
}
export interface DistributionSettings { method: DistributionMethod; balanceCod: boolean; considerWeight: boolean; useLocationRules: boolean }
export type AssignmentReason = 'Matched by Pincode'|'Matched by Route'|'Matched by Area'|'Matched by Area Alias'|'Balanced by Capacity'|'Equal Distribution'|'Priority Distribution'|'Unassigned – No Matching Executive'|'Unassigned – Capacity Full'|'Unassigned – COD Limit'|'Unassigned – Weight Limit';
export interface Assignment { shipment: Shipment; executiveId: string | null; reason: AssignmentReason; status: 'Assigned'|'Unassigned'; manual?: boolean }
export interface ExecutiveResult { executive: Executive; assignments: Assignment[]; newLoad: number; finalLoad: number; codAmount: number; weight: number; utilization: number; status: 'Balanced'|'Near Capacity'|'Full'|'Overloaded' }
export interface DistributionResult { assignments: Assignment[]; executiveResults: ExecutiveResult[]; total: number; assigned: number; unassigned: number; totalCapacity: number; totalCod: number; utilization: number }
export type ShipmentField = 'awb'|'pincode'|'area'|'route'|'locality'|'priority'|'paymentType'|'codAmount'|'weight'|'currentStatus';
export type ColumnMapping = Partial<Record<ShipmentField, string>>;
export interface ParsedFile { headers: string[]; rows: Record<string, unknown>[]; suggestedMapping: ColumnMapping }
export interface ValidatedShipments { valid: Shipment[]; invalid: InvalidShipmentRow[] }
