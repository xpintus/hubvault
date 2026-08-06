import { supabase } from '@/lib/supabase';
import { NDR_REASON_FILTERS, NDR_WORKFLOW_STATUS } from './ndrConstants';
import { normalizeNDRReason } from './ndrReasonNormalizer';

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
    normalizedReason,
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
      hub:hub_id(id, name, code)
    `,
      { count: 'exact' }
    );

  if (hubId && hubId !== 'ALL') {
    query = query.eq('hub_id', hubId);
  }

  if (workflowStatus && workflowStatus !== 'ALL') {
    if (
      workflowStatus === NDR_WORKFLOW_STATUS.CALLING_PENDING ||
      workflowStatus === 'UNDEL' ||
      workflowStatus === 'CALL_PENDING'
    ) {
      query = query.in('ndr_workflow_status', ['UNDEL', NDR_WORKFLOW_STATUS.CALLING_PENDING]);
    } else {
      query = query.eq('ndr_workflow_status', workflowStatus);
    }
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
    const o = otpStatus.toLowerCase();
    if (o === 'otp') {
      query = query.or('otp_status.ilike.%otp%,otp_status.ilike.%failed%,otp_status.ilike.%issue%,original_ndr_reason.ilike.%otp%');
    } else {
      query = query.ilike('otp_status', `%${otpStatus}%`);
    }
  }
  if (deliveryStatus && deliveryStatus !== 'ALL') {
    query = query.eq('shipment_status_current', deliveryStatus);
  }

  const effectiveReason = normalizedReason || (reason && reason !== 'ALL' ? reason : undefined);
  if (effectiveReason && effectiveReason !== 'ALL') {
    query = query.or(`normalized_ndr_reason.eq.${effectiveReason},original_ndr_reason.ilike.%${effectiveReason}%`);
  }

  if (aging && Number(aging) > 0) {
    const cutoff = new Date(Date.now() - Number(aging) * 60 * 60 * 1000).toISOString();
    query = query.lte('created_at', cutoff);
  }

  if (params.isToday) {
    const todayStr = new Date().toISOString().split('T')[0];
    query = query.gte('created_at', `${todayStr}T00:00:00.000Z`).lte('created_at', `${todayStr}T23:59:59.999Z`);
  }

  if (params.attempts && params.attempts !== 'ALL') {
    const att = params.attempts.toString();
    if (att === 'fresh' || att === '1') {
      query = query.eq('total_attempts', 1);
    } else if (att === 'reattempt') {
      query = query.gte('total_attempts', 2);
    } else if (att === '2') {
      query = query.eq('total_attempts', 2);
    } else if (att === '3' || att === '3+') {
      query = query.gte('total_attempts', 3);
    }
  }

  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(
      `awb_number.ilike.%${s}%,consignee_name.ilike.%${s}%,client_name.ilike.%${s}%,delivery_executive.ilike.%${s}%,partner_name.ilike.%${s}%,delivery_pincode.ilike.%${s}%,drs_code.ilike.%${s}%`
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (workflowStatus === NDR_WORKFLOW_STATUS.CALLING_PENDING || workflowStatus === 'Calling Pending') {
    query = query.order('total_attempts', { ascending: false }).order('created_at', { ascending: false }).range(from, to);
  } else {
    query = query.order('created_at', { ascending: false }).range(from, to);
  }

  let { data, count, error } = await query;
  if (error) {
    console.error('Error fetching NDR shipments:', error);
    let fallbackQuery = supabase.from('ndr_shipments').select('*', { count: 'exact' });
    if (hubId && hubId !== 'ALL') fallbackQuery = fallbackQuery.eq('hub_id', hubId);
    if (workflowStatus && workflowStatus !== 'ALL') {
      fallbackQuery = fallbackQuery.eq('ndr_workflow_status', workflowStatus);
    }
    fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).range(from, to);
    const fallbackRes = await fallbackQuery;
    data = fallbackRes.data;
    count = fallbackRes.count;
  }

  const rawList = (data as NDRShipment[]) || [];
  rawList.forEach((s) => {
    if (s.raw_data) {
      s.last_caller_remark = (s.raw_data.last_caller_remark as string) || undefined;
      s.last_supervisor_remark = (s.raw_data.last_supervisor_remark as string) || undefined;
      s.last_caller_result = (s.raw_data.last_caller_result as string) || undefined;
      s.last_supervisor_action = (s.raw_data.last_supervisor_action as string) || undefined;
    }
  });

  return {
    data: rawList,
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
  if (!hubId) {
    throw new Error('Please select a hub before importing the NDR report.');
  }

  const validRows = rows.filter((r) => r.errors.length === 0 && !r.isDuplicateInFile);
  if (validRows.length === 0) {
    throw new Error('No valid shipment rows were found ready to import.');
  }

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

  if (batchErr) throw batchErr;

  let importedCount = 0;
  let updatedCount = 0;

  const awbList = validRows.map((r) => r.waybill_no);
  const existingMap = await fetchExistingAWBMap(awbList, hubId);

  const newInserts: any[] = [];
  const updates: { id: string; payload: any; timeline: any }[] = [];
  const timelineLogs: any[] = [];

  for (const r of validRows) {
    const existing = existingMap.get(r.waybill_no);
    const normReason = normalizeNDRReason(r.reason);

    if (existing) {
      updatedCount++;
      const nextAttempt = Math.max(existing.total_attempts || 1, r.total_attemps || 1);

      updates.push({
        id: existing.id,
        payload: {
          total_attempts: nextAttempt,
          last_attempt_date: r.last_attempt_date || r.POD_date || new Date().toISOString(),
          otp_status: r.otp_details || existing.otp_status,
          drs_code: r.drs_code || existing.drs_code,
          original_ndr_reason: r.reason || existing.original_ndr_reason,
          normalized_ndr_reason: normReason,
          updated_at: new Date().toISOString(),
        },
        timeline: {
          shipment_id: existing.id,
          event_type: 'import',
          action_title: 'Re-imported from Excel',
          user_id: userId,
          user_name: userName || 'Operations Staff',
          user_role: userRole || 'hub_admin',
          previous_status: existing.ndr_workflow_status,
          new_status: existing.ndr_workflow_status,
          remarks: `Updated via file "${filename}". Attempts: ${nextAttempt}`,
          meta_data: { filename, batch_id: batch.id },
        },
      });
    } else {
      importedCount++;
      const newShipmentId = crypto.randomUUID ? crypto.randomUUID() : `ndr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      newInserts.push({
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
        payment_type: r.payment_type?.toUpperCase().includes('COD') ? 'COD' : 'PREPAID',
        amount_payable: r.amount_payable || 0,
        shipment_status_original: 'UNDEL',
        original_ndr_reason: r.reason,
        normalized_ndr_reason: normReason,
        otp_status: r.otp_details,
        drs_status: r.drs_status,
        drs_date: r.drs_date || new Date().toISOString(),
        first_attempt_date: r.first_attempt_date || new Date().toISOString(),
        last_attempt_date: r.last_attempt_date || new Date().toISOString(),
        total_attempts: r.total_attemps || 1,
        delivery_pincode: r.delivery_pincode,
        is_mobility: r.is_mobility,
        shipment_status_current: 'UNDEL',
        ndr_workflow_status: 'Calling Pending',
        hub_id: hubId,
        import_batch_id: batch.id,
        ndr_cycle: 1,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      timelineLogs.push({
        shipment_id: newShipmentId,
        event_type: 'import',
        action_title: 'Imported from Excel',
        user_id: userId,
        user_name: userName || 'Operations Staff',
        user_role: userRole || 'hub_admin',
        previous_status: undefined,
        new_status: 'Calling Pending',
        remarks: `Imported via file "${filename}"`,
        meta_data: { filename, batch_id: batch.id },
      });
    }
  }

  const CHUNK_SIZE = 200;
  if (newInserts.length > 0) {
    for (let i = 0; i < newInserts.length; i += CHUNK_SIZE) {
      const chunk = newInserts.slice(i, i + CHUNK_SIZE);
      await supabase.from('ndr_shipments').insert(chunk);
    }
  }

  if (updates.length > 0) {
    for (const item of updates) {
      await supabase.from('ndr_shipments').update(item.payload).eq('id', item.id);
      timelineLogs.push(item.timeline);
    }
  }

  if (timelineLogs.length > 0) {
    for (let i = 0; i < timelineLogs.length; i += CHUNK_SIZE) {
      const chunk = timelineLogs.slice(i, i + CHUNK_SIZE);
      await supabase.from('ndr_timeline_logs').insert(chunk);
    }
  }

  await supabase.from('ndr_import_batches').update({ status: 'completed' }).eq('id', batch.id);
  return { batchId: batch.id, importedCount, updatedCount };
}

export async function logNDRCall(params: {
  shipmentId: string;
  callerId: string | null;
  callerName: string | null;
  userRole?: string | null;
  callConnected: boolean;
  attemptNumber: number;
  callerResult: string;
  callerRemarks?: string;
  alternateNumber?: string;
  nextFollowupDate?: string;
}): Promise<void> {
  const { shipmentId, callerId, callerName, userRole, callConnected, attemptNumber, callerResult, callerRemarks, alternateNumber, nextFollowupDate } = params;

  const { data: act, error: logErr } = await supabase
    .from('ndr_call_logs')
    .insert({
      shipment_id: shipmentId,
      caller_id: callerId,
      caller_name: callerName || 'Operations Call Executive',
      call_date: new Date().toISOString().split('T')[0],
      call_connected: callConnected,
      attempt_number: attemptNumber,
      caller_result: callerResult,
      caller_remarks: callerRemarks || null,
      alternate_number: alternateNumber || null,
      next_followup_date: nextFollowupDate || null,
    })
    .select()
    .single();

  if (logErr) throw logErr;

  const newWorkflow = nextFollowupDate ? 'Follow-up' : 'Supervisor Pending';

  const { data: currentShipment } = await supabase
    .from('ndr_shipments')
    .select('ndr_workflow_status, raw_data, total_attempts')
    .eq('id', shipmentId)
    .single();

  const updatedRawData = {
    ...(currentShipment?.raw_data || {}),
    last_caller_remark: callerRemarks || null,
    last_caller_result: callerResult,
    alternate_number: alternateNumber || null,
  };

  await supabase
    .from('ndr_shipments')
    .update({
      ndr_workflow_status: newWorkflow,
      assigned_caller_id: callerId || undefined,
      raw_data: updatedRawData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId);

  await supabase.from('ndr_timeline_logs').insert({
    shipment_id: shipmentId,
    event_type: 'caller_update',
    action_title: `Call Logged: ${callerResult}`,
    user_id: callerId,
    user_name: callerName || 'Call Executive',
    user_role: userRole || 'caller',
    previous_status: currentShipment?.ndr_workflow_status,
    new_status: newWorkflow,
    remarks: callerRemarks || `Result: ${callerResult}`,
    meta_data: { call_log_id: act.id, result: callerResult, followup: nextFollowupDate },
  });
}

export async function submitSupervisorAction(params: {
  shipmentId: string;
  supervisorId: string | null;
  supervisorName: string | null;
  userRole?: string | null;
  actionTaken: 'Approve Delivery' | 'Approve Reattempt' | 'Approve RTO';
  supervisorRemarks?: string;
}): Promise<void> {
  const { shipmentId, supervisorId, supervisorName, userRole, actionTaken, supervisorRemarks } = params;

  if (!supervisorRemarks || !supervisorRemarks.trim()) {
    throw new Error('Supervisor Remark is mandatory.');
  }

  const { data: act, error: actErr } = await supabase
    .from('ndr_supervisor_actions')
    .insert({
      shipment_id: shipmentId,
      supervisor_id: supervisorId,
      supervisor_name: supervisorName || 'Operations Supervisor',
      action_taken: actionTaken,
      supervisor_remarks: supervisorRemarks.trim(),
    })
    .select()
    .single();

  if (actErr) throw actErr;

  let newWorkflowStatus: NDRWorkflowStatus = 'Supervisor Pending';
  let shipmentStatusCurrent: string | undefined = undefined;
  let finalAction: string | undefined = undefined;
  let deliveredAfterNdr: boolean = false;

  if (actionTaken === 'Approve Delivery') {
    newWorkflowStatus = 'Delivered';
    shipmentStatusCurrent = 'DEL';
    finalAction = 'Delivered After NDR';
    deliveredAfterNdr = true;
  } else if (actionTaken === 'Approve Reattempt') {
    newWorkflowStatus = 'Follow-up';
    shipmentStatusCurrent = 'UNDEL';
  } else if (actionTaken === 'Approve RTO') {
    newWorkflowStatus = 'RTO';
    shipmentStatusCurrent = 'RTO';
    finalAction = 'RTO Approved';
  }

  const { data: currentShipment } = await supabase
    .from('ndr_shipments')
    .select('ndr_workflow_status, raw_data, total_attempts')
    .eq('id', shipmentId)
    .single();

  const updatedRawData = {
    ...(currentShipment?.raw_data || {}),
    last_supervisor_remark: supervisorRemarks,
    last_supervisor_action: actionTaken,
  };

  const updatePayload: Record<string, unknown> = {
    ndr_workflow_status: newWorkflowStatus,
    assigned_supervisor_id: supervisorId || undefined,
    raw_data: updatedRawData,
    updated_at: new Date().toISOString(),
  };

  if (shipmentStatusCurrent) updatePayload.shipment_status_current = shipmentStatusCurrent;
  if (finalAction) updatePayload.final_action = finalAction;
  if (deliveredAfterNdr) updatePayload.delivered_after_ndr = deliveredAfterNdr;

  if (actionTaken === 'Approve Reattempt') {
    updatePayload.total_attempts = (currentShipment?.total_attempts || 1) + 1;
  }

  await supabase
    .from('ndr_shipments')
    .update(updatePayload)
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
    remarks: supervisorRemarks,
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
  const { shipmentId, userId, userName, userRole, deliveredDate, podReference, codCollectedAmount, expectedAmount } = params;

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
      final_action: 'Delivered After NDR',
      delivered_after_ndr: true,
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
      final_action: 'RTO Approved',
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

  if (error) return [];
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
  let query = supabase.from('ndr_shipments').select('ndr_workflow_status, shipment_status_current, created_at, updated_at, total_attempts, original_ndr_reason, normalized_ndr_reason');

  if (hubId && hubId !== 'ALL') {
    query = query.eq('hub_id', hubId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching NDR metrics:', error);
    return {
      todaysUpload: 0,
      totalActive: 0,
      freshShipments: 0,
      reattemptPending: 0,
      callingPending: 0,
      supervisorPending: 0,
      followUpToday: 0,
      deliveredToday: 0,
      rtoClosed: 0,
      attempt1Count: 0,
      attempt2Count: 0,
      attempt3Count: 0,
      attempt4PlusCount: 0,
      totalOfdAttemptsToday: 0,
      customerRefusedToAccept: 0,
      customerRefusedOtp: 0,
      customerNotReachable: 0,
      phoneSwitchedOff: 0,
      futureDeliveryRequested: 0,
      fakeOrder: 0,
      addressIssue: 0,
      paymentIssue: 0,
      otpIssue: 0,
      deDidNotVisit: 0,
      otherReasons: 0,
    };
  }

  const items = data || [];
  const todayStr = new Date().toISOString().split('T')[0];

  let todaysUpload = 0;
  let freshShipments = 0;
  let reattemptPending = 0;
  let callingPending = 0;
  let supervisorPending = 0;
  let followUpToday = 0;
  let deliveredToday = 0;
  let rtoClosed = 0;

  let attempt1Count = 0;
  let attempt2Count = 0;
  let attempt3Count = 0;
  let attempt4PlusCount = 0;
  let totalOfdAttemptsToday = 0;

  let customerRefusedToAccept = 0;
  let customerRefusedOtp = 0;
  let customerNotReachable = 0;
  let phoneSwitchedOff = 0;
  let futureDeliveryRequested = 0;
  let fakeOrder = 0;
  let addressIssue = 0;
  let paymentIssue = 0;
  let otpIssue = 0;
  let deDidNotVisit = 0;
  let otherReasons = 0;

  items.forEach((item) => {
    const wf = item.ndr_workflow_status;
    const currStat = item.shipment_status_current;
    const attempts = item.total_attempts || 1;
    const createdDate = item.created_at ? item.created_at.split('T')[0] : '';
    const updatedDate = item.updated_at ? item.updated_at.split('T')[0] : '';

    if (createdDate === todayStr) {
      todaysUpload++;
      totalOfdAttemptsToday += attempts;
      if (attempts === 1) attempt1Count++;
      else if (attempts === 2) attempt2Count++;
      else if (attempts === 3) attempt3Count++;
      else if (attempts >= 4) attempt4PlusCount++;
    }

    if (wf === 'UNDEL' || wf === 'Calling Pending') callingPending++;
    else if (wf === 'Supervisor Review' || wf === 'Supervisor Pending') supervisorPending++;
    else if (wf === 'Follow-up' || wf === 'Reattempt Required') followUpToday++;
    else if (wf === 'RTO' || wf === 'Closed' || currStat === 'RTO') rtoClosed++;

    if ((wf === 'Delivered' || currStat === 'DEL') && updatedDate === todayStr) {
      deliveredToday++;
    }

    if ((wf === 'UNDEL' || wf === 'Calling Pending') && attempts === 1) {
      freshShipments++;
    } else if ((wf === 'UNDEL' || wf === 'Calling Pending' || wf === 'Follow-up') && attempts >= 2) {
      reattemptPending++;
    }

    // Reason-wise calculation
    const category = normalizeNDRReason(item.normalized_ndr_reason || item.original_ndr_reason);
    if (category === 'Customer Refused to Accept') customerRefusedToAccept++;
    else if (category === 'Customer Refused OTP') customerRefusedOtp++;
    else if (category === 'Customer Not Reachable') customerNotReachable++;
    else if (category === 'Phone Switched Off') phoneSwitchedOff++;
    else if (category === 'Future Delivery Requested') futureDeliveryRequested++;
    else if (category === 'Fake Order') fakeOrder++;
    else if (category === 'Address Issue') addressIssue++;
    else if (category === 'Payment Issue') paymentIssue++;
    else if (category === 'OTP Issue') otpIssue++;
    else if (category === 'Delivery Executive Did Not Visit') deDidNotVisit++;
    else otherReasons++;
  });

  const totalActive = callingPending + supervisorPending + followUpToday;

  return {
    todaysUpload,
    totalActive,
    freshShipments,
    reattemptPending,
    callingPending,
    supervisorPending,
    followUpToday,
    deliveredToday,
    rtoClosed,
    attempt1Count,
    attempt2Count,
    attempt3Count,
    attempt4PlusCount,
    totalOfdAttemptsToday,
    customerRefusedToAccept,
    customerRefusedOtp,
    customerNotReachable,
    phoneSwitchedOff,
    futureDeliveryRequested,
    fakeOrder,
    addressIssue,
    paymentIssue,
    otpIssue,
    deDidNotVisit,
    otherReasons,
  };
}

export async function fetchImportBatches(hubId?: string | null): Promise<NDRImportBatch[]> {
  let query = supabase.from('ndr_import_batches').select('*').order('created_at', { ascending: false });

  if (hubId && hubId !== 'ALL') {
    query = query.eq('hub_id', hubId);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data as NDRImportBatch[]) || [];
}
