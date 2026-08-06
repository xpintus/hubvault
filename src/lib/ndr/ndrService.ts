import { supabase } from '@/lib/supabase';
import {
  NDRCallLog,
  NDRFilterParams,
  NDRImportBatch,
  NDRMetrics,
  NDRShipment,
  NDRSupervisorAction,
  NDRTimelineLog,
  NDRWorkflowStatus,
  ParsedNDRExcelRow,
} from '@/types/ndr';

export async function fetchNDRShipments(
  params: NDRFilterParams = {}
): Promise<{ data: NDRShipment[]; count: number }> {
  const {
    search,
    startDate,
    endDate,
    hubId,
    vendor,
    executive,
    status,
    workflowStatus,
    reason,
    callerId,
    supervisorId,
    paymentType,
    otpStatus,
    deliveryStatus,
    followUpDate,
    aging,
    page = 1,
    limit = 50,
  } = params;

  let query = supabase
    .from('ndr_shipments')
    .select(
      `
      *,
      assigned_caller:assigned_caller_id(id, name, email),
      assigned_supervisor:assigned_supervisor_id(id, name, email),
      hub:hub_id(id, name, code)
    `,
      { count: 'exact' }
    );

  if (hubId && hubId !== 'ALL') {
    query = query.eq('hub_id', hubId);
  }
  if (workflowStatus && workflowStatus !== 'ALL') {
    query = query.eq('ndr_workflow_status', workflowStatus);
  }
  if (vendor && vendor !== 'ALL') {
    query = query.ilike('partner_name', `%${vendor}%`);
  }
  if (executive && executive !== 'ALL') {
    query = query.ilike('delivery_executive', `%${executive}%`);
  }
  if (callerId && callerId !== 'ALL') {
    query = query.eq('assigned_caller_id', callerId);
  }
  if (supervisorId && supervisorId !== 'ALL') {
    query = query.eq('assigned_supervisor_id', supervisorId);
  }
  if (paymentType && paymentType !== 'ALL') {
    query = query.eq('payment_type', paymentType);
  }
  if (otpStatus && otpStatus !== 'ALL') {
    query = query.ilike('otp_status', `%${otpStatus}%`);
  }
  if (deliveryStatus && deliveryStatus !== 'ALL') {
    query = query.eq('shipment_status_current', deliveryStatus);
  }
  if (reason && reason !== 'ALL') {
    query = query.ilike('original_ndr_reason', `%${reason}%`);
  }
  if (aging && Number(aging) > 0) {
    const cutoff = new Date(Date.now() - Number(aging) * 60 * 60 * 1000).toISOString();
    query = query.lte('created_at', cutoff);
  }

  if (startDate) {
    query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
  }


  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(
      `awb_number.ilike.%${s}%,consignee_name.ilike.%${s}%,client_name.ilike.%${s}%,delivery_executive.ilike.%${s}%,partner_name.ilike.%${s}%,delivery_pincode.ilike.%${s}%,drs_code.ilike.%${s}%`
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error fetching NDR shipments:', error);
    throw error;
  }

  return {
    data: (data as NDRShipment[]) || [],
    count: count || 0,
  };
}

export async function fetchExistingAWBMap(
  awbNumbers: string[],
  hubId?: string | null
): Promise<Map<string, NDRShipment>> {
  if (awbNumbers.length === 0) return new Map();

  let query = supabase.from('ndr_shipments').select('*').in('awb_number', awbNumbers);

  if (hubId) {
    query = query.eq('hub_id', hubId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error checking existing AWBs:', error);
    return new Map();
  }

  const map = new Map<string, NDRShipment>();
  (data as NDRShipment[]).forEach((item) => {
    map.set(item.awb_number, item);
  });
  return map;
}

export async function importNDRBatch(
  filename: string,
  rows: ParsedNDRExcelRow[],
  hubId: string | null,
  userId: string | null,
  userName: string | null,
  userRole: string | null,
  onProgress?: (message: string) => void
): Promise<{ batchId: string; importedCount: number; updatedCount: number }> {
  // 1. Hub ID check
  if (!hubId) {
    throw new Error('Please select a hub before importing the NDR report.');
  }

  // 2. Migration & Table Existence Check
  const { error: checkErr } = await supabase.from('ndr_shipments').select('id').limit(1);
  if (checkErr) {
    if (
      checkErr.code === '42P01' ||
      checkErr.message?.includes('does not exist') ||
      checkErr.message?.includes('relation "public.ndr_shipments"')
    ) {
      throw new Error('NDR database migration has not been applied. Required table ndr_shipments was not found.');
    }
  }

  const validRows = rows.filter((r) => r.errors.length === 0 && !r.isDuplicateInFile);
  if (validRows.length === 0) {
    throw new Error('No valid shipment rows were found ready to import.');
  }

  // 3. Create batch record with status 'processing'
  const { data: batch, error: batchErr } = await supabase
    .from('ndr_import_batches')
    .insert({
      filename,
      uploaded_by: userId,
      uploaded_by_name: userName || 'Operations Staff',
      upload_time: new Date().toISOString(),
      total_rows: rows.length,
      valid_rows: validRows.length,
      duplicate_rows: rows.filter((r) => r.isDuplicateInFile).length,
      invalid_rows: rows.filter((r) => r.errors.length > 0).length,
      ready_to_import: validRows.length,
      status: 'processing',
      hub_id: hubId,
    })
    .select()
    .single();

  if (batchErr) {
    console.error('NDR import failed creating batch', {
      message: batchErr.message,
      code: batchErr.code,
      details: batchErr.details,
      hint: batchErr.hint,
    });
    throw new Error(batchErr.message || 'Failed to create import batch record.');
  }

  try {
    onProgress?.('Checking existing AWBs in database...');
    const awbList = validRows.map((r) => r.waybill_no);
    const existingMap = await fetchExistingAWBMap(awbList, hubId);

    const newInserts: Partial<NDRShipment>[] = [];
    const updates: { id: string; payload: Partial<NDRShipment>; timeline: Partial<NDRTimelineLog> }[] = [];
    const timelineLogs: Partial<NDRTimelineLog>[] = [];

    let importedCount = 0;
    let updatedCount = 0;

    for (const r of validRows) {
      const existing = existingMap.get(r.waybill_no);

      if (existing) {
        updatedCount++;
        const isClosed = existing.ndr_workflow_status === 'Closed';
        const newCycle = isClosed ? existing.ndr_cycle + 1 : existing.ndr_cycle;
        const newWorkflowStatus: NDRWorkflowStatus = 'UNDEL';

        const updatePayload: Partial<NDRShipment> = {
          drs_code: r.drs_code || existing.drs_code,
          delivery_executive: r.Employee_name || existing.delivery_executive,
          partner_name: r.partner_name || existing.partner_name,
          hub_location: r.LOCATION || existing.hub_location,
          city: r.city || existing.city,
          state: r.state || existing.state,
          amount_payable: r.amount_payable || existing.amount_payable,
          payment_type: r.payment_type || existing.payment_type,
          last_attempt_date: r.last_attempt_date || new Date().toISOString(),
          total_attempts: r.total_attemps || existing.total_attempts + 1,
          delivery_pincode: r.delivery_pincode || existing.delivery_pincode,
          drs_status: r.drs_status || existing.drs_status,
          shipment_status_current: 'UNDEL',
          ndr_workflow_status: newWorkflowStatus,
          ndr_cycle: newCycle,
          import_batch_id: batch.id,
          updated_at: new Date().toISOString(),
        };

        const timelineEntry: Partial<NDRTimelineLog> = {
          shipment_id: existing.id,
          event_type: 'import',
          action_title: isClosed ? `Re-imported NDR (Cycle ${newCycle})` : 'Re-imported Open NDR',
          user_id: userId,
          user_name: userName || 'Operations Staff',
          user_role: userRole || 'hub_admin',
          previous_status: existing.ndr_workflow_status,
          new_status: newWorkflowStatus,
          remarks: `Updated from file "${filename}". ${isClosed ? 'New NDR Cycle initiated.' : 'Updated operational details.'}`,
          meta_data: { filename, batch_id: batch.id, cycle: newCycle },
        };

        updates.push({ id: existing.id, payload: updatePayload, timeline: timelineEntry });
      } else {
        importedCount++;
        const newShipmentId = crypto.randomUUID();
        const insertPayload: Partial<NDRShipment> = {
          id: newShipmentId,
          awb_number: r.waybill_no,
          drs_code: r.drs_code,
          client_name: r.customer_name,
          consignee_name: r.consignee,
          delivery_executive: r.Employee_name,
          partner_name: r.partner_name,
          hub_location: r.LOCATION,
          city: r.city,
          state: r.state,
          payment_type: r.payment_type || 'COD',
          amount_payable: r.amount_payable,

          shipment_status_original: r.shipment_status || 'UNDEL',
          original_ndr_reason: r.reason,
          otp_status: r.otp_details,
          drs_status: r.drs_status,
          drs_date: r.drs_date || null,
          first_attempt_date: r.first_attempt_date || new Date().toISOString(),
          last_attempt_date: r.last_attempt_date || new Date().toISOString(),
          total_attempts: r.total_attemps || 1,
          delivery_pincode: r.delivery_pincode,
          is_mobility: r.is_mobility,

          shipment_status_current: 'UNDEL',
          ndr_workflow_status: 'UNDEL',
          hub_id: hubId,
          import_batch_id: batch.id,
          ndr_cycle: 1,
          raw_data: {
            drs_code: r.drs_code,
            waybill_no: r.waybill_no,
            Employee_name: r.Employee_name,
            partner_name: r.partner_name,
            LOCATION: r.LOCATION,
            city: r.city,
            customer_name: r.customer_name,
            consignee: r.consignee,
            reason: r.reason,
            otp_details: r.otp_details,
          },
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        newInserts.push(insertPayload);

        timelineLogs.push({
          shipment_id: newShipmentId,
          event_type: 'import',
          action_title: 'Imported from Excel',
          user_id: userId,
          user_name: userName || 'Operations Staff',
          user_role: userRole || 'hub_admin',
          previous_status: undefined,
          new_status: 'UNDEL',
          remarks: `Imported via file "${filename}"`,
          meta_data: { filename, batch_id: batch.id },
        });
      }
    }

    // Execute Inserts in chunks of 200
    const CHUNK_SIZE = 200;
    if (newInserts.length > 0) {
      for (let i = 0; i < newInserts.length; i += CHUNK_SIZE) {
        const chunk = newInserts.slice(i, i + CHUNK_SIZE);
        onProgress?.(`Importing ${Math.min(i + chunk.length, newInserts.length)} of ${newInserts.length} new shipments...`);
        const { error: insErr } = await supabase.from('ndr_shipments').insert(chunk);
        if (insErr) {
          console.error('NDR shipment chunk insert error:', {
            message: insErr.message,
            code: insErr.code,
            details: insErr.details,
            hint: insErr.hint,
          });
          throw insErr;
        }
      }
    }

    // Execute Updates & Timeline entries
    if (updates.length > 0) {
      onProgress?.(`Updating ${updates.length} existing NDR shipments...`);
      for (const item of updates) {
        const { error: updErr } = await supabase.from('ndr_shipments').update(item.payload).eq('id', item.id);
        if (updErr) {
          console.error('NDR shipment update error:', updErr);
          throw updErr;
        }
        timelineLogs.push(item.timeline);
      }
    }

    // Insert Timeline logs in chunks of 200
    if (timelineLogs.length > 0) {
      onProgress?.('Recording audit timeline entries...');
      for (let i = 0; i < timelineLogs.length; i += CHUNK_SIZE) {
        const chunk = timelineLogs.slice(i, i + CHUNK_SIZE);
        const { error: timeErr } = await supabase.from('ndr_timeline_logs').insert(chunk);
        if (timeErr) {
          console.error('NDR timeline insert error:', timeErr);
          throw timeErr;
        }
      }
    }

    // Mark batch completed
    await supabase
      .from('ndr_import_batches')
      .update({ status: 'completed' })
      .eq('id', batch.id);

    return { batchId: batch.id, importedCount, updatedCount };
  } catch (err: any) {
    // Mark batch failed on error
    await supabase
      .from('ndr_import_batches')
      .update({ status: 'failed', error_message: err.message || 'Import process failed' })
      .eq('id', batch.id);

    console.error('NDR import batch execution failed:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
    });
    throw err;
  }
}


export async function logNDRCall(params: {
  shipmentId: string;
  callerId: string | null;
  callerName: string | null;
  userRole: string | null;
  callConnected: boolean;
  attemptNumber: number;
  customerResponse?: string;
  callerResult: NDRCallLog['caller_result'];
  customerVerifiedReason?: string;
  customerComplaint?: string;
  customerWantsDelivery: boolean;
  preferredDeliveryDate?: string;
  alternateNumber?: string;
  nextFollowupDate?: string;
  callerRemarks?: string;
  callDuration?: string;
}): Promise<void> {
  const { shipmentId, callerId, callerName, userRole, callerResult } = params;

  // Insert Call Log
  const { data: callLog, error: callErr } = await supabase
    .from('ndr_call_logs')
    .insert({
      shipment_id: shipmentId,
      caller_id: callerId,
      caller_name: callerName || 'Calling Executive',
      call_date: new Date().toISOString().split('T')[0],
      call_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      call_connected: params.callConnected,
      attempt_number: params.attemptNumber,
      customer_response: params.customerResponse || null,
      caller_result: callerResult,
      customer_verified_reason: params.customerVerifiedReason || null,
      customer_complaint: params.customerComplaint || null,
      customer_wants_delivery: params.customerWantsDelivery,
      preferred_delivery_date: params.preferredDeliveryDate || null,
      alternate_number: params.alternateNumber || null,
      next_followup_date: params.nextFollowupDate || null,
      caller_remarks: params.callerRemarks || null,
      call_duration: params.callDuration || null,
    })
    .select()
    .single();

  if (callErr) throw callErr;

  // Determine new workflow status based on caller result
  let newWorkflowStatus: NDRWorkflowStatus = 'Customer Contacted';
  if (
    callerResult === 'Customer Wants Tomorrow Delivery' ||
    callerResult === 'Future Delivery Requested' ||
    params.customerWantsDelivery
  ) {
    newWorkflowStatus = 'Reattempt Required';
  } else if (
    callerResult === 'Fake Order' ||
    callerResult === 'Customer Refused Order' ||
    callerResult === 'Customer Wants RTO' ||
    callerResult === 'Wrong Number'
  ) {
    newWorkflowStatus = 'Supervisor Review';
  } else if (callerResult === 'Customer Not Reachable' || callerResult === 'Phone Switched Off') {
    newWorkflowStatus = 'Calling Pending';
  }

  // Get current status for timeline
  const { data: currentShipment } = await supabase
    .from('ndr_shipments')
    .select('ndr_workflow_status')
    .eq('id', shipmentId)
    .single();

  // Update Shipment
  const { error: shipErr } = await supabase
    .from('ndr_shipments')
    .update({
      ndr_workflow_status: newWorkflowStatus,
      assigned_caller_id: callerId || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId);

  if (shipErr) throw shipErr;

  // Log Timeline Event
  await supabase.from('ndr_timeline_logs').insert({
    shipment_id: shipmentId,
    event_type: 'caller_update',
    action_title: `Call Logged: ${callerResult}`,
    user_id: callerId,
    user_name: callerName || 'Calling Executive',
    user_role: userRole || 'collector',
    previous_status: currentShipment?.ndr_workflow_status,
    new_status: newWorkflowStatus,
    remarks: params.callerRemarks || `Outcome: ${callerResult}`,
    meta_data: { call_log_id: callLog.id, caller_result: callerResult },
  });
}

export async function submitSupervisorAction(params: {
  shipmentId: string;
  supervisorId: string | null;
  supervisorName: string | null;
  userRole: string | null;
  supervisorCalledCustomer: boolean;
  deliveryExecutiveReasonCorrect: boolean;
  fakeAttemptSuspected: boolean;
  otpMisuseSuspected: boolean;
  escalateDeliveryExecutive: boolean;
  escalateVendor: boolean;
  actionTaken: NDRSupervisorAction['action_taken'];
  supervisorRemarks?: string;
  nextActionDate?: string;
}): Promise<void> {
  const { shipmentId, supervisorId, supervisorName, userRole, actionTaken } = params;

  // Insert Supervisor Action
  const { data: act, error: actErr } = await supabase
    .from('ndr_supervisor_actions')
    .insert({
      shipment_id: shipmentId,
      supervisor_id: supervisorId,
      supervisor_name: supervisorName || 'Operations Supervisor',
      supervisor_called_customer: params.supervisorCalledCustomer,
      delivery_executive_reason_correct: params.deliveryExecutiveReasonCorrect,
      fake_attempt_suspected: params.fakeAttemptSuspected,
      otp_misuse_suspected: params.otpMisuseSuspected,
      escalate_delivery_executive: params.escalateDeliveryExecutive,
      escalate_vendor: params.escalateVendor,
      action_taken: actionTaken,
      supervisor_remarks: params.supervisorRemarks || null,
      next_action_date: params.nextActionDate || null,
    })
    .select()
    .single();

  if (actErr) throw actErr;

  let newWorkflowStatus: NDRWorkflowStatus = 'Supervisor Review';

  if (actionTaken === 'Approve Reattempt') {
    newWorkflowStatus = 'Reattempt Approved';
  } else if (actionTaken === 'Reject Reattempt' || actionTaken === 'Recommend RTO') {
    newWorkflowStatus = 'Supervisor Review';
  } else if (actionTaken === 'Close NDR') {
    newWorkflowStatus = 'Closed';
  }

  const { data: currentShipment } = await supabase
    .from('ndr_shipments')
    .select('ndr_workflow_status')
    .eq('id', shipmentId)
    .single();

  await supabase
    .from('ndr_shipments')
    .update({
      ndr_workflow_status: newWorkflowStatus,
      assigned_supervisor_id: supervisorId || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId);

  await supabase.from('ndr_timeline_logs').insert({
    shipment_id: shipmentId,
    event_type: 'supervisor_update',
    action_title: `Supervisor Action: ${actionTaken}`,
    user_id: supervisorId,
    user_name: supervisorName || 'Operations Supervisor',
    user_role: userRole || 'supervisor',
    previous_status: currentShipment?.ndr_workflow_status,
    new_status: newWorkflowStatus,
    remarks: params.supervisorRemarks || `Action: ${actionTaken}`,
    meta_data: { action_id: act.id, action_taken: actionTaken },
  });
}

export async function markNDRDelivered(params: {
  shipmentId: string;
  userId: string | null;
  userName: string | null;
  userRole?: string | null;
  deliveredDate: string;

  deliveredByText?: string;
  podReference: string;
  codCollectedAmount: number;
  expectedAmount: number;
  codExceptionRemark?: string;
  deliveryRemarks?: string;
}): Promise<void> {
  const { shipmentId, userId, userName, userRole, deliveredDate, podReference, codCollectedAmount, expectedAmount } =
    params;

  // Validate COD mismatch
  const isMismatch = Math.abs(codCollectedAmount - expectedAmount) > 0.01;
  if (isMismatch && (!params.codExceptionRemark || !params.codExceptionRemark.trim())) {
    throw new Error('COD Collected amount differs from expected payable amount. Exception remark is required.');
  }

  const { data: currentShipment } = await supabase
    .from('ndr_shipments')
    .select('ndr_workflow_status, shipment_status_current')
    .eq('id', shipmentId)
    .single();

  const { error: updateErr } = await supabase
    .from('ndr_shipments')
    .update({
      shipment_status_current: 'DEL',
      ndr_workflow_status: 'Closed',
      delivered_date: new Date(deliveredDate).toISOString(),
      delivered_by: userId,
      delivered_user: params.deliveredByText || userName || 'Delivery Agent',
      pod_reference: podReference,
      cod_collected_amount: codCollectedAmount,
      cod_exception_remark: params.codExceptionRemark || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId);

  if (updateErr) throw updateErr;

  await supabase.from('ndr_timeline_logs').insert({
    shipment_id: shipmentId,
    event_type: 'delivered',
    action_title: 'Delivered After NDR Calling',
    user_id: userId,
    user_name: userName || 'Supervisor',
    user_role: userRole || 'supervisor',
    previous_status: currentShipment?.ndr_workflow_status,
    new_status: 'Closed',
    remarks: `Shipment delivered. POD Ref: ${podReference}. COD Collected: ₹${codCollectedAmount}. ${params.deliveryRemarks || ''}`,
    meta_data: {
      pod_reference: podReference,
      cod_collected: codCollectedAmount,
      expected_amount: expectedAmount,
      exception_remark: params.codExceptionRemark,
    },
  });
}

export async function approveNDRRTO(params: {
  shipmentId: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  rtoReason: string;
  rtoRemarks?: string;
  expectedRtoDate?: string;
}): Promise<void> {
  const { shipmentId, userId, userName, userRole, rtoReason, rtoRemarks, expectedRtoDate } = params;

  const { data: currentShipment } = await supabase
    .from('ndr_shipments')
    .select('ndr_workflow_status')
    .eq('id', shipmentId)
    .single();

  const { error: updateErr } = await supabase
    .from('ndr_shipments')
    .update({
      shipment_status_current: 'RTO',
      ndr_workflow_status: 'Closed',
      rto_date: new Date().toISOString(),
      rto_reason: rtoReason,
      rto_remarks: rtoRemarks || null,
      expected_rto_date: expectedRtoDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId);

  if (updateErr) throw updateErr;

  await supabase.from('ndr_timeline_logs').insert({
    shipment_id: shipmentId,
    event_type: 'rto',
    action_title: 'RTO Approved & Queued',
    user_id: userId,
    user_name: userName || 'Supervisor',
    user_role: userRole || 'supervisor',
    previous_status: currentShipment?.ndr_workflow_status,
    new_status: 'Closed',
    remarks: `RTO Reason: ${rtoReason}. ${rtoRemarks || ''}`,
    meta_data: { rto_reason: rtoReason, expected_rto_date: expectedRtoDate },
  });
}

export async function fetchNDRTimeline(shipmentId: string): Promise<NDRTimelineLog[]> {
  const { data, error } = await supabase
    .from('ndr_timeline_logs')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching NDR timeline:', error);
    return [];
  }
  return (data as NDRTimelineLog[]) || [];
}

export async function fetchNDRCallLogs(shipmentId: string): Promise<NDRCallLog[]> {
  const { data, error } = await supabase
    .from('ndr_call_logs')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data as NDRCallLog[]) || [];
}

export async function fetchNDRSupervisorActions(shipmentId: string): Promise<NDRSupervisorAction[]> {
  const { data, error } = await supabase
    .from('ndr_supervisor_actions')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data as NDRSupervisorAction[]) || [];
}

export async function fetchNDRMetrics(hubId?: string | null): Promise<NDRMetrics> {
  let query = supabase.from('ndr_shipments').select('ndr_workflow_status, shipment_status_current, original_ndr_reason, otp_status, created_at, last_attempt_date');

  if (hubId && hubId !== 'ALL') {
    query = query.eq('hub_id', hubId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching NDR metrics:', error);
    return {
      totalImported: 0,
      callingPending: 0,
      contacted: 0,
      supervisorPending: 0,
      followUpDue: 0,
      reattemptApproved: 0,
      outForDelivery: 0,
      deliveredAfterNdr: 0,
      rto: 0,
      otpIssues: 0,
      fakeAttempt: 0,
      wrongNdr: 0,
      futureDelivery: 0,
      customerRefused: 0,
      customerNotReachable: 0,
      above24Hours: 0,
      above48Hours: 0,
      above72Hours: 0,
    };
  }

  const items = data || [];
  const now = new Date().getTime();

  let callingPending = 0;
  let contacted = 0;
  let supervisorPending = 0;
  let followUpDue = 0;
  let reattemptApproved = 0;
  let outForDelivery = 0;
  let deliveredAfterNdr = 0;
  let rto = 0;
  let otpIssues = 0;
  let fakeAttempt = 0;
  let wrongNdr = 0;
  let futureDelivery = 0;
  let customerRefused = 0;
  let customerNotReachable = 0;
  let above24Hours = 0;
  let above48Hours = 0;
  let above72Hours = 0;

  items.forEach((item) => {
    const wf = item.ndr_workflow_status;
    const currStat = item.shipment_status_current;
    const reason = (item.original_ndr_reason || '').toLowerCase();
    const otp = (item.otp_status || '').toLowerCase();

    if (wf === 'UNDEL' || wf === 'Calling Pending') callingPending++;
    if (wf === 'Customer Contacted') contacted++;
    if (wf === 'Supervisor Review') supervisorPending++;
    if (wf === 'Reattempt Required') followUpDue++;
    if (wf === 'Reattempt Approved') reattemptApproved++;
    if (wf === 'Out For Delivery') outForDelivery++;

    if (currStat === 'DEL') deliveredAfterNdr++;
    if (currStat === 'RTO') rto++;

    if (otp.includes('failed') || otp.includes('issue') || otp.includes('invalid') || reason.includes('otp')) {
      otpIssues++;
    }
    if (reason.includes('fake') || reason.includes('suspected')) fakeAttempt++;
    if (reason.includes('wrong') || reason.includes('invalid address')) wrongNdr++;
    if (reason.includes('future') || reason.includes('tomorrow')) futureDelivery++;
    if (reason.includes('refuse') || reason.includes('denied')) customerRefused++;
    if (reason.includes('unreachable') || reason.includes('not reachable') || reason.includes('switched off')) {
      customerNotReachable++;
    }

    const createdTime = new Date(item.created_at).getTime();
    const diffHours = (now - createdTime) / (1000 * 60 * 60);

    if (diffHours >= 24) above24Hours++;
    if (diffHours >= 48) above48Hours++;
    if (diffHours >= 72) above72Hours++;
  });

  return {
    totalImported: items.length,
    callingPending,
    contacted,
    supervisorPending,
    followUpDue,
    reattemptApproved,
    outForDelivery,
    deliveredAfterNdr,
    rto,
    otpIssues,
    fakeAttempt,
    wrongNdr,
    futureDelivery,
    customerRefused,
    customerNotReachable,
    above24Hours,
    above48Hours,
    above72Hours,
  };
}

export async function fetchImportBatches(hubId?: string | null): Promise<NDRImportBatch[]> {
  let query = supabase.from('ndr_import_batches').select('*').order('created_at', { ascending: false });

  if (hubId && hubId !== 'ALL') {
    query = query.eq('hub_id', hubId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching import batches:', error);
    return [];
  }
  return (data as NDRImportBatch[]) || [];
}
