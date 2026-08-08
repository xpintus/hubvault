import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserBody {
  email: string;
  password: string;
  name: string;
  role: "super_admin" | "hub_admin" | "supervisor" | "collector";
  hub_id: string | null;
  can_create_hub?: boolean;
  hub_ids?: string[];
}

interface CreateTrialUserBody {
  email: string;
  password: string;
  name: string;
  phone: string;
  company: string;
  hub_code: string;
  location?: string;
}

interface CreateBuyerBody {
  name: string;
  email: string;
  password: string;
  phone: string;
  company?: string;
  hub_name?: string;
  hub_code?: string;
  hub_location?: string;
  referral_code?: string;
  plan_type?: "lifetime" | "monthly";
}

interface ResetPasswordBody {
  user_id: string;
  new_password: string;
}

interface DeleteUserBody {
  user_id: string;
}

interface UpdateUserBody {
  user_id: string;
  name?: string;
  role?: "super_admin" | "hub_admin" | "supervisor" | "collector";
  hub_id?: string | null;
  can_create_hub?: boolean;
  hub_ids?: string[];
}

const VALID_ROLES = ["super_admin", "hub_admin", "supervisor", "collector"];

function generateLicenseCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 16; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
    if (i % 4 === 3 && i < 15) code += "-";
  }
  return code;
}

async function logSubscriptionHistory(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  oldPlan: string | null,
  newPlan: string | null,
  oldExpiry: string | null,
  newExpiry: string | null,
  changedBy: string | null,
  reason: string
): Promise<void> {
  try {
    await adminClient.from("subscription_history").insert({
      user_id: userId,
      old_plan: oldPlan,
      new_plan: newPlan,
      old_expiry: oldExpiry,
      new_expiry: newExpiry,
      changed_by: changedBy,
      reason,
    });
  } catch (err) {
    console.error("logSubscriptionHistory error:", err);
  }
}

async function createLicenseForUser(adminClient: ReturnType<typeof createClient>, userId: string, planType: "lifetime" | "monthly" = "lifetime"): Promise<string> {
  const licenseCode = generateLicenseCode();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Delete any existing key for this user, then insert fresh
  await adminClient.from("license_keys").delete().eq("user_id", userId);

  const { error: insertErr } = await adminClient.from("license_keys").insert({
    user_id: userId,
    license_code: licenseCode,
    status: "pending",
    generated_at: new Date().toISOString(),
    expires_at: expiresAt,
    plan_type: planType,
  });

  if (insertErr) {
    throw new Error("Failed to insert license key: " + insertErr.message);
  }

  const { error: profileErr } = await adminClient.from("profiles").update({
    license_status: "pending",
    license_expires_at: expiresAt,
    license_activated_at: null,
    plan_type: planType,
    subscription_status: "none",
  }).eq("id", userId);

  if (profileErr) {
    throw new Error("Failed to update profile license status: " + profileErr.message);
  }

  return licenseCode;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") as string;

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "create";

  // Public action: create trial user without authentication
  if (action === "create-trial-public") {
    if (req.method !== "POST") return jsonError(405, "Method not allowed");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const body = await req.json() as CreateTrialUserBody;

      if (!body.name || !body.email || !body.password || !body.phone || !body.company || !body.hub_code || !body.location) {
        return jsonError(400, "All fields are required");
      }
      if (!body.location.trim()) {
        return jsonError(400, "Location is required");
      }
      if (body.name.trim().length < 2) {
        return jsonError(400, "Name must be at least 2 characters");
      }
      if (!/^\d{10}$/.test(body.phone.trim())) {
        return jsonError(400, "Phone number must be exactly 10 digits");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        return jsonError(400, "Invalid email address");
      }
      if (body.password.length < 6) {
        return jsonError(400, "Password must be at least 6 characters");
      }
      const validCompanies = ["Valmo", "Amazon", "Flipkart", "Shadowfax", "Delhivery"];
      if (!validCompanies.includes(body.company)) {
        return jsonError(400, "Invalid company selected");
      }

      // Check if email already exists
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", body.email.trim())
        .maybeSingle();
      if (existing) {
        return jsonError(409, "An account with this email already exists");
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
        user_metadata: {
          name: body.name.trim(),
          role: "trial_user",
          company: body.company,
          hub_code: body.hub_code.trim(),
          phone: body.phone.trim(),
          location: body.location.trim(),
        },
      });

      if (createErr || !newUser.user) {
        return jsonError(400, createErr?.message || "Failed to create trial user");
      }

      const newUserId = newUser.user.id;

      await adminClient.from("profiles").upsert({
        id: newUserId,
        name: body.name.trim(),
        email: body.email.trim(),
        role: "trial_user",
        hub_id: null,
        can_create_hub: false,
        phone: body.phone.trim(),
        company: body.company,
        hub_code: body.hub_code.trim(),
        location: body.location.trim(),
        is_approved: false,
      }, { onConflict: "id" });

      await adminClient.from("audit_logs").insert({
        action: "user_created",
        performed_by: null,
        target_user_id: newUserId,
        details: `Public trial signup: ${body.name} (${body.company}, hub: ${body.hub_code}, loc: ${body.location.trim()})`,
      });

      return jsonResponse(200, { user_id: newUserId, message: "Trial user created" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return jsonError(500, msg);
    }
  }

  // Public action: create buyer (hub_admin) without authentication
  if (action === "create-buyer") {
    if (req.method !== "POST") return jsonError(405, "Method not allowed");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const body = await req.json() as CreateBuyerBody;

      if (!body.name || !body.email || !body.password || !body.phone || !body.hub_name || !body.hub_code) {
        return jsonError(400, "Name, email, password, phone, hub name, and hub code are required");
      }
      if (body.name.trim().length < 2) {
        return jsonError(400, "Name must be at least 2 characters");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        return jsonError(400, "Invalid email address");
      }
      if (body.password.length < 6) {
        return jsonError(400, "Password must be at least 6 characters");
      }
      if (!/^[+]?[\d\s()-]{7,15}$/.test(body.phone.trim())) {
        return jsonError(400, "Please enter a valid phone number");
      }

      const requestedHubCode = body.hub_code.trim().toUpperCase();
      if (!/^[A-Z0-9-]{3,16}$/.test(requestedHubCode)) {
        return jsonError(400, "Hub code must contain 3–16 letters, numbers, or hyphens");
      }

      // Check if email already exists
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", body.email.trim())
        .maybeSingle();
      if (existing) {
        return jsonError(409, "An account with this email already exists");
      }

      const { data: existingHub } = await adminClient
        .from("hubs")
        .select("id")
        .eq("code", requestedHubCode)
        .maybeSingle();
      if (existingHub) {
        return jsonError(409, "This hub code is already in use. Please choose another code");
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
        user_metadata: {
          name: body.name.trim(),
          role: "hub_admin",
          can_create_hub: true,
        },
      });

      if (createErr || !newUser.user) {
        return jsonError(400, createErr?.message || "Failed to create account");
      }

      const newUserId = newUser.user.id;

      await adminClient.from("profiles").upsert({
        id: newUserId,
        name: body.name.trim(),
        email: body.email.trim(),
        role: "hub_admin",
        hub_id: null,
        can_create_hub: true,
        phone: body.phone.trim(),
        company: body.company?.trim() || null,
        is_approved: true,
      }, { onConflict: "id" });

      await adminClient.from("audit_logs").insert({
        action: "buyer_account_created",
        performed_by: null,
        target_user_id: newUserId,
        details: `Buy Now purchase: ${body.name} (${body.email.trim()})${body.company ? ` — ${body.company.trim()}` : ""}`,
      });

      // Mark the purchase request as completed if one exists
      await adminClient.from("purchase_requests")
        .update({ status: "completed", is_read: true })
        .eq("email", body.email.trim());

      // Create the buyer's first hub and auto-assign them
      const hubName = body.hub_name.trim();
      const hubCode = requestedHubCode;
      const hubLocation = body.hub_location?.trim() || null;

      const { data: newHub, error: hubErr } = await adminClient.from("hubs").insert({
        name: hubName,
        code: hubCode,
        location: hubLocation,
        status: "active",
        created_by: newUserId,
      }).select().single();

      if (hubErr || !newHub) {
        await adminClient.auth.admin.deleteUser(newUserId);
        const duplicateCode = hubErr?.code === "23505";
        return jsonError(duplicateCode ? 409 : 500, duplicateCode ? "This hub code is already in use. Please choose another code" : `Account was not created because the hub could not be created: ${hubErr?.message || "Unknown hub error"}`);
      }
      const hubId = newHub.id;

      const { error: accessErr } = await adminClient.from("user_hub_access").upsert({
        user_id: newUserId,
        hub_id: hubId,
      }, { onConflict: "user_id,hub_id" });
      const { error: profileHubErr } = await adminClient.from("profiles").update({ hub_id: hubId }).eq("id", newUserId);
      if (accessErr || profileHubErr) {
        await adminClient.from("hubs").delete().eq("id", hubId);
        await adminClient.auth.admin.deleteUser(newUserId);
        return jsonError(500, `Account was not created because hub assignment failed: ${accessErr?.message || profileHubErr?.message}`);
      }

      await adminClient.from("audit_logs").insert({
        action: "hub_created",
        performed_by: null,
        target_user_id: newUserId,
        target_hub_id: hubId,
        details: `Auto-created hub "${hubName}" (${hubCode}) for buyer ${body.name}`,
      });

      // Notify every super admin about the newly registered buyer.
      await adminClient.from("notifications").insert({
        user_id: null,
        type: "buyer_registered",
        title: "New Buyer Registered",
        message: `${body.name.trim()} registered from Buy Now with hub ${hubName} (${hubCode}).`,
        link: "/purchases",
        is_read: false,
        metadata: { user_id: newUserId, hub_id: hubId, email: body.email.trim() },
      });

      // Process referral/promo code if provided
      if (body.referral_code?.trim()) {
        const promoCode = body.referral_code.trim().toUpperCase();

        // Find referrer by referral code
        const { data: referrer } = await adminClient
          .from("profiles")
          .select("id, name, referral_code")
          .eq("referral_code", promoCode)
          .maybeSingle();

        if (referrer) {
          // Link the referral
          await adminClient.from("profiles")
            .update({ referred_by: referrer.id })
            .eq("id", newUserId);

          // Create referral record
          await adminClient.from("referrals").insert({
            referrer_id: referrer.id,
            referee_id: newUserId,
            referral_code: promoCode,
            status: "pending",
          });

          await adminClient.from("audit_logs").insert({
            action: "referral_code_applied",
            performed_by: newUserId,
            target_user_id: referrer.id,
            details: `Promo code ${promoCode} applied during purchase — referred by ${referrer.name}`,
          });
        }
      }

      // Generate license key for buyer (hub_admin)
      await createLicenseForUser(adminClient, newUserId, body.plan_type === "monthly" ? "monthly" : "lifetime");

      return jsonResponse(200, { user_id: newUserId, hub_id: hubId, message: "Hub Admin account created with 30 days of free access" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return jsonError(500, msg);
    }
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonError(401, "Missing authorization header");
  }

  // Client with the CALLER'S token — used for authorization checks (RLS applies)
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  // Service-role client — bypasses RLS, used only AFTER authorization passes
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Get the caller's profile to determine role and accessible hubs
  const { data: callerUser, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !callerUser.user) {
    return jsonError(401, "Invalid session");
  }

  const { data: callerProfile, error: profileErr } = await userClient
    .from("profiles")
    .select("id, role, hub_id")
    .eq("id", callerUser.user.id)
    .maybeSingle();

  if (profileErr || !callerProfile) {
    return jsonError(403, "Could not verify your account");
  }

  const callerRole = callerProfile.role as string;
  const isSuperAdmin = callerRole === "super_admin";
  const isHubAdmin = callerRole === "hub_admin";
  const _isHubManager = isSuperAdmin || isHubAdmin;

  const SELF_SERVICE_ACTIONS = new Set([
    "get-referral-stats", "apply-referral-code", "request-withdrawal", "get-withdrawals",
  ]);

  if (!isSuperAdmin && !isHubAdmin && !SELF_SERVICE_ACTIONS.has(action)) {
    return jsonError(403, "You do not have permission to manage users");
  }

  // Fetch the caller's accessible hub IDs for authorization
  let callerHubIds: string[] = [];
  if (!isSuperAdmin) {
    const { data: accessRows } = await userClient
      .from("user_hub_access")
      .select("hub_id")
      .eq("user_id", callerUser.user.id);
    callerHubIds = (accessRows ?? []).map((r: { hub_id: string }) => r.hub_id);
    if (callerProfile.hub_id && !callerHubIds.includes(callerProfile.hub_id)) {
      callerHubIds.push(callerProfile.hub_id);
    }
  }

  const canManageHub = (hubId: string | null): boolean => {
    if (!hubId) return false;
    if (isSuperAdmin) return true;
    return callerHubIds.includes(hubId);
  };

  try {
    switch (action) {
      case "create": {
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        const body = await req.json() as CreateUserBody;

        if (!body.email || !body.password || !body.name) {
          return jsonError(400, "Name, email, and password are required");
        }
        if (body.password.length < 6) {
          return jsonError(400, "Password must be at least 6 characters");
        }
        if (!VALID_ROLES.includes(body.role)) {
          return jsonError(400, "Invalid role");
        }

        // Prevent non-super_admin from creating super_admin or hub_admin accounts
        if (body.role === "super_admin" && !isSuperAdmin) {
          return jsonError(403, "Only Super Admins can create Super Admin accounts");
        }
        if (body.role === "hub_admin" && !isSuperAdmin) {
          return jsonError(403, "Only Super Admins can create Hub Admin accounts");
        }

        // Validate hub assignments
        const hubIds = body.hub_ids && body.hub_ids.length > 0 ? body.hub_ids : (body.hub_id ? [body.hub_id] : []);
        if (body.role !== "super_admin") {
          if (hubIds.length === 0) {
            return jsonError(400, "At least one hub must be assigned");
          }
          for (const hid of hubIds) {
            if (!canManageHub(hid)) {
              return jsonError(403, "You can only assign hubs you manage");
            }
          }
          if (body.role === "supervisor" && hubIds.length > 1) {
            return jsonError(400, "A supervisor can only be assigned one hub");
          }
        }

        const primaryHubId = body.role === "super_admin" ? null : hubIds[0] ?? null;

        // Create auth user with service role
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: body.email.trim(),
          password: body.password,
          email_confirm: true,
          user_metadata: {
            name: body.name.trim(),
            role: body.role,
            hub_id: primaryHubId ?? "",
            can_create_hub: body.role === "hub_admin" ? !!body.can_create_hub : false,
          },
        });

        if (createErr || !newUser.user) {
          return jsonError(400, createErr?.message || "Failed to create user");
        }

        const newUserId = newUser.user.id;

        // Upsert profile (the trigger should have created it, but ensure it's correct)
        await adminClient.from("profiles").upsert({
          id: newUserId,
          name: body.name.trim(),
          email: body.email.trim(),
          role: body.role,
          hub_id: primaryHubId,
          can_create_hub: body.role === "hub_admin" ? !!body.can_create_hub : false,
        }, { onConflict: "id" });

        // Set hub access
        if (body.role !== "super_admin" && hubIds.length > 0) {
          const accessRows = hubIds.map((hid) => ({ user_id: newUserId, hub_id: hid }));
          await adminClient.from("user_hub_access").upsert(accessRows, { onConflict: "user_id,hub_id" });
        }

        // Generate license key for hub_admin role
        let licenseCode: string | null = null;
        if (body.role === "hub_admin") {
          licenseCode = await createLicenseForUser(adminClient, newUserId);
        }

        // Audit log
        await adminClient.from("audit_logs").insert({
          action: "user_created",
          performed_by: callerUser.user.id,
          target_user_id: newUserId,
          details: `Created ${body.name} as ${body.role} with ${hubIds.length} hub(s)${licenseCode ? ` — License: ${licenseCode}` : ""}`,
        });

        return jsonResponse(200, { user_id: newUserId, license_code: licenseCode, message: "User created" });
      }

      case "create-trial": {
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        if (!isSuperAdmin) {
          return jsonError(403, "Only Super Admins can create trial users");
        }
        const body = await req.json() as CreateTrialUserBody;

        if (!body.name || !body.email || !body.password || !body.phone || !body.company || !body.hub_code) {
          return jsonError(400, "All fields are required");
        }
        if (!/^\d{10}$/.test(body.phone.trim())) {
          return jsonError(400, "Phone number must be exactly 10 digits");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
          return jsonError(400, "Invalid email address");
        }
        if (body.password.length < 6) {
          return jsonError(400, "Password must be at least 6 characters");
        }
        const validCompanies = ["Valmo", "Amazon", "Flipkart", "Shadowfax", "Delhivery"];
        if (!validCompanies.includes(body.company)) {
          return jsonError(400, "Invalid company selected");
        }
        if (!body.location || !body.location.trim()) {
          return jsonError(400, "Location is required");
        }

        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: body.email.trim(),
          password: body.password,
          email_confirm: true,
          user_metadata: {
            name: body.name.trim(),
            role: "trial_user",
            company: body.company,
            hub_code: body.hub_code.trim(),
            phone: body.phone.trim(),
            location: body.location.trim(),
          },
        });

        if (createErr || !newUser.user) {
          return jsonError(400, createErr?.message || "Failed to create trial user");
        }

        const newUserId = newUser.user.id;

        await adminClient.from("profiles").upsert({
          id: newUserId,
          name: body.name.trim(),
          email: body.email.trim(),
          role: "trial_user",
          hub_id: null,
          can_create_hub: false,
          phone: body.phone.trim(),
          company: body.company,
          hub_code: body.hub_code.trim(),
          location: body.location.trim(),
          is_approved: false,
        }, { onConflict: "id" });

        await adminClient.from("audit_logs").insert({
          action: "user_created",
          performed_by: callerUser.user.id,
          target_user_id: newUserId,
          details: `Created trial user ${body.name} (${body.company}, hub: ${body.hub_code}, loc: ${body.location.trim()})`,
        });

        return jsonResponse(200, { user_id: newUserId, message: "Trial user created" });
      }

      case "update": {
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        const body = await req.json() as UpdateUserBody;

        if (!body.user_id) return jsonError(400, "user_id is required");

        // Fetch the target user's current profile
        const { data: target, error: targetErr } = await userClient
          .from("profiles")
          .select("id, role, hub_id, email, name")
          .eq("id", body.user_id)
          .maybeSingle();

        if (targetErr || !target) {
          return jsonError(404, "User not found or you do not have access");
        }

        // Authorization: super_admin can edit anyone; hub_admin/supervisor
        // can only edit users in their accessible hubs
        if (!isSuperAdmin) {
          if (!canManageHub(target.hub_id)) {
            return jsonError(403, "You can only manage users in your assigned hubs");
          }
          // Prevent editing a super_admin or hub_admin
          if (target.role === "super_admin" || target.role === "hub_admin") {
            return jsonError(403, "You cannot modify another admin account");
          }
          // Prevent escalating to super_admin or hub_admin
          if (body.role === "super_admin") {
            return jsonError(403, "Only Super Admins can assign the Super Admin role");
          }
          if (body.role === "hub_admin") {
            return jsonError(403, "Only Super Admins can assign the Hub Admin role");
          }
        }

        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.role !== undefined) {
          if (!VALID_ROLES.includes(body.role)) return jsonError(400, "Invalid role");
          updates.role = body.role;
        }
        if (body.hub_id !== undefined) {
          if (body.role && body.role !== "super_admin" && !canManageHub(body.hub_id)) {
            return jsonError(403, "You can only assign hubs you manage");
          }
          updates.hub_id = body.role === "super_admin" ? null : body.hub_id;
        }
        if (body.can_create_hub !== undefined) {
          updates.can_create_hub = body.role === "hub_admin" ? !!body.can_create_hub : false;
        }

        const { error: updateErr } = await adminClient.from("profiles")
          .update(updates).eq("id", body.user_id);
        if (updateErr) {
          return jsonError(500, "Failed to update user: " + updateErr.message);
        }

        // Sync hub access if provided
        if (body.hub_ids !== undefined && (body.role ?? target.role) !== "super_admin") {
          for (const hid of body.hub_ids) {
            if (!canManageHub(hid)) {
              return jsonError(403, "You can only assign hubs you manage");
            }
          }
          const { data: existing } = await adminClient.from("user_hub_access")
            .select("id, hub_id").eq("user_id", body.user_id);
          const existingHubIds = (existing ?? []).map((r: { hub_id: string }) => r.hub_id);
          const toAdd = body.hub_ids.filter((hid) => !existingHubIds.includes(hid));
          const toRemove = (existing ?? []).filter(
            (r: { id: string; hub_id: string }) => !body.hub_ids!.includes(r.hub_id)
          );

          if (toAdd.length > 0) {
            await adminClient.from("user_hub_access").insert(
              toAdd.map((hid) => ({ user_id: body.user_id, hub_id: hid }))
            );
          }
          if (toRemove.length > 0) {
            await adminClient.from("user_hub_access").delete()
              .in("id", toRemove.map((r: { id: string }) => r.id));
          }
        }

        await adminClient.from("audit_logs").insert({
          action: "user_role_changed",
          performed_by: callerUser.user.id,
          target_user_id: body.user_id,
          details: `Updated ${body.name ?? target.name}`,
        });

        return jsonResponse(200, { message: "User updated" });
      }

      case "reset-password": {
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        const body = await req.json() as ResetPasswordBody;

        if (!body.user_id || !body.new_password) {
          return jsonError(400, "user_id and new_password are required");
        }
        if (body.new_password.length < 6) {
          return jsonError(400, "Password must be at least 6 characters");
        }

        // Verify the caller can manage this user
        const { data: target } = await userClient
          .from("profiles")
          .select("role, hub_id, name")
          .eq("id", body.user_id)
          .maybeSingle();

        if (!target) {
          return jsonError(404, "User not found or you do not have access");
        }

        if (!isSuperAdmin) {
          if (!canManageHub(target.hub_id)) {
            return jsonError(403, "You can only manage users in your assigned hubs");
          }
          if (target.role === "super_admin") {
            return jsonError(403, "You cannot modify a Super Admin account");
          }
        }

        const { error: resetErr } = await adminClient.auth.admin.updateUserById(
          body.user_id,
          { password: body.new_password }
        );
        if (resetErr) {
          return jsonError(500, "Failed to reset password: " + resetErr.message);
        }

        await adminClient.from("audit_logs").insert({
          action: "permissions_changed",
          performed_by: callerUser.user.id,
          target_user_id: body.user_id,
          details: `Reset password for ${target.name}`,
        });

        return jsonResponse(200, { message: "Password reset" });
      }

      case "delete": {
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        const body = await req.json() as DeleteUserBody;

        if (!body.user_id) return jsonError(400, "user_id is required");
        if (body.user_id === callerUser.user.id) {
          return jsonError(400, "You cannot delete your own account");
        }

        const { data: target } = await userClient
          .from("profiles")
          .select("role, hub_id, name")
          .eq("id", body.user_id)
          .maybeSingle();

        if (!target) {
          return jsonError(404, "User not found or you do not have access");
        }

        if (!isSuperAdmin) {
          if (!canManageHub(target.hub_id)) {
            return jsonError(403, "You can only manage users in your assigned hubs");
          }
          if (target.role === "super_admin") {
            return jsonError(403, "You cannot delete a Super Admin account");
          }
        }

        // Delete the auth user. Operational history retains a nullable actor.
        const { error: delErr } = await adminClient.auth.admin.deleteUser(body.user_id);
        if (delErr) {
          return jsonError(500, "Failed to delete user: " + delErr.message);
        }

        await adminClient.from("audit_logs").insert({
          action: "user_deactivated",
          performed_by: callerUser.user.id,
          target_user_id: null,
          details: `Deleted user ${target.name} (${body.user_id})`,
        });

        return jsonResponse(200, { message: "User deleted" });
      }

      case "approve-trial": {
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        if (!isSuperAdmin) {
          return jsonError(403, "Only Super Admins can approve trial users");
        }
        const body = await req.json() as { user_id: string; approved: boolean };
        if (!body.user_id) return jsonError(400, "user_id is required");

        const { data: target } = await userClient
          .from("profiles")
          .select("role, name")
          .eq("id", body.user_id)
          .maybeSingle();

        if (!target) return jsonError(404, "User not found");
        if (target.role !== "trial_user") return jsonError(400, "Only trial users can be approved/rejected");

        const { error: updErr } = await adminClient.from("profiles")
          .update({ is_approved: body.approved }).eq("id", body.user_id);
        if (updErr) return jsonError(500, "Failed to update approval status");

        await adminClient.from("audit_logs").insert({
          action: "permissions_changed",
          performed_by: callerUser.user.id,
          target_user_id: body.user_id,
          details: `${body.approved ? "Approved" : "Revoked"} trial access for ${target.name}`,
        });

        return jsonResponse(200, { message: body.approved ? "Trial user approved" : "Trial access revoked" });
      }

      case "activate-license": {
        // Self-service: a hub_admin activates their own license
        const body = await req.json() as { license_code: string };
        if (!body.license_code) return jsonError(400, "License code is required");

        const code = body.license_code.trim().toUpperCase();

        // Fetch caller's profile
        const { data: myProfile } = await userClient
          .from("profiles")
          .select("id, role, license_status, license_expires_at, plan_type, subscription_started_at, subscription_expires_at, subscription_status, renewal_count")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        if (!myProfile) return jsonError(404, "Profile not found");
        if (myProfile.role !== "hub_admin") return jsonError(403, "Only Hub Admins need license activation");

        // Check if already activated and active lifetime
        if (myProfile.license_status === "activated" && myProfile.plan_type === "lifetime") {
          return jsonError(400, "Your lifetime license is already activated");
        }

        // Look up the license key
        const { data: license } = await adminClient
          .from("license_keys")
          .select("*")
          .eq("user_id", myProfile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!license) return jsonError(404, "No license found for your account. Please contact your administrator.");
        if (license.status === "expired") return jsonError(410, "Your license has expired. Please contact your administrator for a new code.");
        if (license.status === "activated" && license.plan_type === "lifetime") return jsonError(400, "Your lifetime license is already activated");

        // Validate the code (compare without dashes)
        const normalize = (s: string) => s.replace(/-/g, "").toUpperCase();
        if (normalize(license.license_code) !== normalize(code)) {
          return jsonError(400, "Invalid license code. Please check and try again.");
        }

        const now = new Date().toISOString();
        const targetPlan = license.plan_type || myProfile.plan_type || "lifetime";

        await adminClient.from("license_keys").update({
          status: "activated",
          activated_at: now,
          plan_type: targetPlan,
        }).eq("id", license.id);

        if (targetPlan === "lifetime") {
          await adminClient.from("profiles").update({
            license_status: "activated",
            license_activated_at: now,
            license_expires_at: null,
            plan_type: "lifetime",
            subscription_started_at: now,
            subscription_expires_at: null,
            subscription_status: "active",
            last_payment_at: now,
          }).eq("id", myProfile.id);

          await logSubscriptionHistory(
            adminClient,
            myProfile.id,
            myProfile.plan_type || null,
            "lifetime",
            myProfile.subscription_expires_at || null,
            null,
            myProfile.id,
            "License activated: Lifetime Plan"
          );
        } else {
          // Monthly plan
          const currentExpiry = myProfile.subscription_expires_at ? new Date(myProfile.subscription_expires_at) : null;
          const isCurrentlyActive = currentExpiry && currentExpiry > new Date();

          let newExpiryDate: Date;
          let startedAt: string;

          if (isCurrentlyActive && currentExpiry) {
            // Extend existing expiry by 30 days
            newExpiryDate = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
            startedAt = myProfile.subscription_started_at || now;
          } else {
            // New 30 days from now
            newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            startedAt = now;
          }

          const newExpiryStr = newExpiryDate.toISOString();
          const renewalCount = (myProfile.renewal_count || 0) + 1;

          await adminClient.from("profiles").update({
            license_status: "activated",
            license_activated_at: now,
            license_expires_at: newExpiryStr,
            plan_type: "monthly",
            subscription_started_at: startedAt,
            subscription_expires_at: newExpiryStr,
            subscription_status: "active",
            last_payment_at: now,
            next_billing_at: newExpiryStr,
            renewal_count: renewalCount,
          }).eq("id", myProfile.id);

          await logSubscriptionHistory(
            adminClient,
            myProfile.id,
            myProfile.plan_type || null,
            "monthly",
            myProfile.subscription_expires_at || null,
            newExpiryStr,
            myProfile.id,
            isCurrentlyActive ? "Subscription extended by 30 days" : "License activated: Monthly Plan (30 days)"
          );
        }

        await adminClient.from("audit_logs").insert({
          action: "license_activated",
          performed_by: myProfile.id,
          target_user_id: myProfile.id,
          details: `License activated (${targetPlan} plan)`,
        });

        await creditReferralCommission(adminClient, myProfile.id, targetPlan === "monthly" ? 99 : 999, myProfile.id);

        return jsonResponse(200, { message: "License activated successfully" });
      }

      case "generate-license":
      case "regenerate-license": {
        // Super Admin generates or regenerates a license for a hub_admin
        if (!isSuperAdmin) {
          return jsonError(403, "Only Super Admins can manage license keys");
        }
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        const body = await req.json() as { user_id: string };
        if (!body.user_id) return jsonError(400, "user_id is required");

        const { data: target } = await adminClient
          .from("profiles")
          .select("role, name, plan_type")
          .eq("id", body.user_id)
          .maybeSingle();

        if (!target) return jsonError(404, "User not found");
        if (target.role !== "hub_admin") return jsonError(400, "License keys are only for Hub Admins");

        // Regenerating a code must never silently change a monthly account to
        // lifetime. A pending checkout request is the freshest plan choice;
        // otherwise preserve the plan already assigned to the profile.
        const { data: pendingPlanRequest } = await adminClient
          .from("license_payment_requests")
          .select("plan_type")
          .eq("user_id", body.user_id)
          .eq("request_type", "license")
          .eq("status", "pending")
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const targetPlan = pendingPlanRequest?.plan_type === "monthly" || target.plan_type === "monthly"
          ? "monthly"
          : "lifetime";
        const newCode = await createLicenseForUser(adminClient, body.user_id, targetPlan);

        await adminClient.from("audit_logs").insert({
          action: action === "generate-license" ? "license_generated" : "license_regenerated",
          performed_by: callerUser.user.id,
          target_user_id: body.user_id,
          details: `${action === "generate-license" ? "Generated" : "Regenerated"} ${targetPlan} license for ${target.name}: ${newCode}`,
        });

        return jsonResponse(200, { license_code: newCode, message: action === "generate-license" ? "License generated" : "License regenerated" });
      }

      case "check-license": {
        // Check caller's license status and auto-expire if past deadline + grace period
        const { data: myProfile } = await userClient
          .from("profiles")
          .select("id, role, plan_type, license_status, license_expires_at, license_activated_at, subscription_status, subscription_expires_at")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        if (!myProfile) return jsonError(404, "Profile not found");

        const { data: settings } = await adminClient
          .from("app_settings")
          .select("subscription_grace_days")
          .eq("id", 1)
          .maybeSingle();

        const graceDays = settings?.subscription_grace_days || 0;

        if (myProfile.role !== "super_admin" && myProfile.plan_type === "monthly") {
          const expiryStr = myProfile.subscription_expires_at || myProfile.license_expires_at;
          if (expiryStr) {
            const expiryTime = new Date(expiryStr).getTime();
            const graceMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
            if (Date.now() > expiryTime + graceMs) {
              await adminClient.from("profiles").update({
                license_status: "expired",
                subscription_status: "expired",
              }).eq("id", myProfile.id);
              await adminClient.from("license_keys").update({ status: "expired" }).eq("user_id", myProfile.id);

              await logSubscriptionHistory(
                adminClient,
                myProfile.id,
                "monthly",
                "monthly",
                expiryStr,
                expiryStr,
                null,
                "Auto-expired via check-license"
              );

              myProfile.license_status = "expired";
              myProfile.subscription_status = "expired";
            }
          }
        }

        return jsonResponse(200, {
          role: myProfile.role,
          plan_type: myProfile.plan_type,
          license_status: myProfile.license_status,
          subscription_status: myProfile.subscription_status,
          subscription_expires_at: myProfile.subscription_expires_at || myProfile.license_expires_at,
          license_expires_at: myProfile.license_expires_at,
          license_activated_at: myProfile.license_activated_at,
        });
      }
          role: myProfile.role,
          license_status: myProfile.license_status,
          license_expires_at: myProfile.license_expires_at,
          license_activated_at: myProfile.license_activated_at,
        });
      }

      case "request-license-upi": {
        // Hub admin submits a manual UPI payment request (license or hub_add)
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        // Fetch caller's full profile
        const { data: myProfile } = await adminClient
          .from("profiles")
          .select("id, role, name, email, license_status")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        if (!myProfile) return jsonError(404, "Profile not found");
        if (myProfile.role !== "hub_admin") return jsonError(403, "Only Hub Admins can request licenses");

        const body = await req.json() as {
          transaction_id: string;
          payment_method?: string;
          payer_name?: string;
          payer_upi?: string;
          amount?: number;
          notes?: string;
          request_type?: "license" | "hub_add";
          plan_type?: "lifetime" | "monthly";
          payment_screenshot_url?: string;
        };

        if (!body.transaction_id || !body.transaction_id.trim()) {
          return jsonError(400, "Transaction ID / UTR is required");
        }

        const requestType = body.request_type === "hub_add" ? "hub_add" : "license";
        const planType = body.plan_type === "monthly" || (requestType === "license" && Number(body.amount) === 99) ? "monthly" : "lifetime";

        // For hub_add requests, check if license is already activated
        if (requestType === "hub_add" && myProfile.license_status !== "activated") {
          return jsonError(400, "You must activate your license first before purchasing additional hubs.");
        }

        // Check if user already has a pending request of the same type
        const { data: existingReq } = await adminClient
          .from("license_payment_requests")
          .select("id, status")
          .eq("user_id", myProfile.id)
          .eq("status", "pending")
          .eq("request_type", requestType)
          .maybeSingle();

        if (existingReq) {
          return jsonError(409, requestType === "hub_add"
            ? "You already have a pending hub-add payment request. Please wait for admin verification."
            : "You already have a pending payment request. Please wait for admin verification.");
        }

        const { error: insertErr } = await adminClient.from("license_payment_requests").insert({
          user_id: myProfile.id,
          amount: body.amount || 0,
          payment_method: body.payment_method || "upi",
          transaction_id: body.transaction_id.trim(),
          payer_name: body.payer_name?.trim() || null,
          payer_upi: body.payer_upi?.trim() || null,
          status: "pending",
          notes: body.notes?.trim() || null,
          request_type: requestType,
          plan_type: planType,
          payment_screenshot_url: body.payment_screenshot_url?.trim() || null,
        });

        if (insertErr) return jsonError(500, "Failed to submit payment request: " + insertErr.message);

        // Keep an explicit notification as a durable fallback in addition to
        // the realtime license_payment_requests subscription.
        await adminClient.from("notifications").insert({
          user_id: null,
          type: "payment_request",
          title: requestType === "hub_add" ? "New Hub Payment" : "New License Payment",
          message: `${myProfile.name || myProfile.email} submitted a ${requestType === "hub_add" ? "hub-add" : "license"} payment (UTR: ${body.transaction_id.trim()}).`,
          link: "/licenses",
          is_read: false,
          metadata: { user_id: myProfile.id, request_type: requestType, transaction_id: body.transaction_id.trim() },
        });

        await adminClient.from("audit_logs").insert({
          action: requestType === "hub_add" ? "hub_add_payment_requested" : "license_payment_requested",
          performed_by: myProfile.id,
          target_user_id: myProfile.id,
          details: `${requestType === "hub_add" ? "Hub-add" : "License"} payment request submitted (TXN: ${body.transaction_id.trim()})`,
        });

        return jsonResponse(200, { message: requestType === "hub_add"
          ? "Hub-add payment request submitted. You'll be able to create a new hub after admin verifies your payment."
          : "Payment request submitted. Your license will be issued after admin verifies your payment." });
      }

      case "redeem-gift-card": {
        // Hub admin redeems a gift card — either for a license key or a hub-add credit
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const { data: myProfile } = await adminClient
          .from("profiles")
          .select("id, role, name, email, license_status")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        if (!myProfile) return jsonError(404, "Profile not found");
        if (myProfile.role !== "hub_admin") return jsonError(403, "Only Hub Admins can redeem gift cards");

        const body = await req.json() as { card_code: string; mode?: string };
        if (!body.card_code || !body.card_code.trim()) {
          return jsonError(400, "Gift card code is required");
        }

        const redeemMode = body.mode || "license";

        if (redeemMode === "license" && myProfile.license_status === "activated") {
          return jsonError(400, "Your license is already activated");
        }

        const cardCode = body.card_code.trim().toUpperCase();

        // Find the gift card
        const { data: card, error: cardErr } = await adminClient
          .from("gift_cards")
          .select("*")
          .eq("card_code", cardCode)
          .maybeSingle();

        if (cardErr || !card) {
          return jsonError(404, "Invalid gift card code. Please check and try again.");
        }

        if (card.status === "disabled") {
          return jsonError(400, "This gift card has been disabled. Please contact support.");
        }
        if (card.status === "redeemed" || card.status === "sold") {
          return jsonError(400, "This gift card has already been used.");
        }
        if (card.status !== "available") {
          return jsonError(400, "This gift card is not available for redemption.");
        }

        // Mark gift card as redeemed
        const now = new Date().toISOString();
        const { error: redeemErr } = await adminClient.from("gift_cards").update({
          status: "redeemed",
          purchased_by: myProfile.id,
          purchased_at: now,
          redeemed_at: now,
        }).eq("id", card.id).eq("status", "available");

        if (redeemErr) {
          return jsonError(500, "Failed to redeem gift card: " + redeemErr.message);
        }

        if (redeemMode === "hub_add") {
          // Grant a hub-add credit atomically
          const { error: incErr } = await adminClient
            .rpc("increment_hub_credit", { p_user_id: myProfile.id, p_amount: 1 });

          if (incErr) {
            // Rollback gift card status
            await adminClient.from("gift_cards").update({
              status: "available",
              purchased_by: null,
              purchased_at: null,
              redeemed_at: null,
            }).eq("id", card.id);
            return jsonError(500, "Failed to grant hub credit: " + incErr.message);
          }

          await adminClient.from("audit_logs").insert({
            action: "gift_card_redeemed_hub_credit",
            performed_by: myProfile.id,
            target_user_id: myProfile.id,
            details: `Gift card ${cardCode} redeemed — 1 hub credit granted`,
          });

          return jsonResponse(200, {
            message: "Gift card redeemed successfully! 1 hub credit added to your account.",
          });
        }

        // License mode: create a license key from the gift card's license_code
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Delete any existing key for this user, then insert fresh
        await adminClient.from("license_keys").delete().eq("user_id", myProfile.id);

        const { error: licErr } = await adminClient.from("license_keys").insert({
          user_id: myProfile.id,
          license_code: card.license_code,
          status: "pending",
          generated_at: now,
          expires_at: expiresAt,
        });

        if (licErr) {
          // Rollback gift card status
          await adminClient.from("gift_cards").update({
            status: "available",
            purchased_by: null,
            purchased_at: null,
            redeemed_at: null,
          }).eq("id", card.id);
          return jsonError(500, "Failed to create license key: " + licErr.message);
        }

        // Update profile
        await adminClient.from("profiles").update({
          license_status: "pending",
          license_expires_at: expiresAt,
          license_activated_at: null,
        }).eq("id", myProfile.id);

        await adminClient.from("audit_logs").insert({
          action: "gift_card_redeemed",
          performed_by: myProfile.id,
          target_user_id: myProfile.id,
          details: `Gift card ${cardCode} redeemed — license code issued`,
        });

        return jsonResponse(200, {
          license_code: card.license_code,
          message: "Gift card redeemed successfully! Your license code is ready to activate.",
        });
      }

      case "check-payment-status": {
        // Hub admin checks status of their payment requests (license + hub_add)
        const { data: requests } = await adminClient
          .from("license_payment_requests")
          .select("*")
          .eq("user_id", callerUser.user.id)
          .order("submitted_at", { ascending: false })
          .limit(20);

        return jsonResponse(200, { requests: requests ?? [] });
      }

      case "create-hub": {
        // Hub admin creates a new hub — first hub is free, additional ones consume a credit
        if (req.method !== "POST") return jsonError(405, "Method not allowed");
        if (callerRole !== "hub_admin") return jsonError(403, "Only Hub Admins can create hubs");

        const body = await req.json() as { name: string; code: string; location?: string };
        if (!body.name?.trim() || !body.code?.trim()) {
          return jsonError(400, "Hub name and code are required");
        }

        // Count existing hubs created by this user — check for errors
        const { count: assignedHubCount, error: countErr } = await adminClient
          .from("user_hub_access")
          .select("*", { count: "exact", head: true })
          .eq("user_id", callerUser.user.id);

        if (countErr) {
          return jsonError(500, "Failed to verify hub count: " + countErr.message);
        }

        const isFirstHub = (assignedHubCount ?? 0) === 0;

        // If not first hub, require a credit — use atomic decrement
        let creditConsumed = false;
        if (!isFirstHub) {
          const { data: decResult, error: decErr } = await adminClient
            .rpc("decrement_hub_credit", { p_user_id: callerUser.user.id });

          if (decErr) {
            return jsonError(500, "Failed to process hub credit: " + decErr.message);
          }
          if (!decResult) {
            return jsonError(403, "You need to purchase a hub-add license (₹499) to create additional hubs. Please submit a payment from the Hubs page.");
          }
          creditConsumed = true;
        }

        const { data: newHub, error: hubErr } = await adminClient.from("hubs").insert({
          name: body.name.trim(),
          code: body.code.trim().toUpperCase(),
          location: body.location?.trim() || null,
          status: "active",
          created_by: callerUser.user.id,
        }).select().single();

        if (hubErr) {
          // If hub creation fails after credit was consumed, refund the credit atomically
          if (creditConsumed) {
            await adminClient.rpc("increment_hub_credit", { p_user_id: callerUser.user.id, p_amount: 1 });
          }
          return jsonError(500, "Failed to create hub: " + hubErr.message);
        }

        // Assign the hub admin to the new hub
        await adminClient.from("user_hub_access").upsert({
          user_id: callerUser.user.id,
          hub_id: newHub.id,
        }, { onConflict: "user_id,hub_id" });

        // Fetch the caller's name for the notification
        const { data: callerInfo } = await adminClient
          .from("profiles")
          .select("name")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        const hubLabel = `${body.name.trim()} (${body.code.trim().toUpperCase()})`;

        await adminClient.from("audit_logs").insert({
          action: "hub_created_by_hub_admin",
          performed_by: callerUser.user.id,
          target_user_id: callerUser.user.id,
          target_hub_id: newHub.id,
          details: `Hub Admin created hub "${body.name.trim()}"${isFirstHub ? " (first free hub)" : " (used 1 hub credit)"}`,
        });

        // Notify all super_admins about the new hub
        await adminClient.from("notifications").insert({
          user_id: null,
          type: "hub_created",
          title: "New Hub Created",
          message: `${callerInfo?.name ?? "A Hub Admin"} created a new hub: ${hubLabel}${isFirstHub ? " (first free hub)" : " (used 1 hub credit)"}`,
          link: "/hubs",
          is_read: false,
          metadata: { hub_id: newHub.id, created_by: callerUser.user.id, first_hub: isFirstHub },
        });

        return jsonResponse(200, { hub_id: newHub.id, message: isFirstHub ? "Hub created (first free hub)" : "Hub created (1 credit consumed)" });
      }

      case "generate-gift-cards": {
        // Super admin generates gift cards in bulk
        if (!isSuperAdmin) return jsonError(403, "Only Super Admins can generate gift cards");
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body = await req.json() as { count: number; price?: number };
        const count = Math.min(Math.max(body.count || 1, 1), 100);
        const price = body.price || 0;

        const cards: { card_code: string; license_code: string; price: number; created_by: string }[] = [];
        for (let i = 0; i < count; i++) {
          const cardCode = generateLicenseCode();
          const licCode = generateLicenseCode();
          cards.push({
            card_code: cardCode,
            license_code: licCode,
            price,
            created_by: callerUser.user.id,
          });
        }

        const { error: batchErr } = await adminClient.from("gift_cards").insert(cards);
        if (batchErr) return jsonError(500, "Failed to generate gift cards: " + batchErr.message);

        await adminClient.from("audit_logs").insert({
          action: "gift_cards_generated",
          performed_by: callerUser.user.id,
          details: `Generated ${count} gift card(s) at price ${price}`,
        });

        return jsonResponse(200, { count, cards });
      }

      case "list-gift-cards": {
        // Super admin lists all gift cards
        if (!isSuperAdmin) return jsonError(403, "Only Super Admins can view gift cards");

        const { data: cards } = await adminClient
          .from("gift_cards")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

        return jsonResponse(200, { cards: cards ?? [] });
      }

      case "list-payment-requests": {
        // Super admin lists all payment requests (fetch profiles separately — user_id → auth.users, no FK to profiles)
        if (!isSuperAdmin) return jsonError(403, "Only Super Admins can view payment requests");

        const { data: requests } = await adminClient
          .from("license_payment_requests")
          .select("*")
          .order("submitted_at", { ascending: false })
          .limit(200);

        const userIds = [...new Set((requests ?? []).map((r: { user_id: string }) => r.user_id))];
        let profileMap = new Map<string, { name: string; email: string; phone?: string }>();
        if (userIds.length > 0) {
          const { data: profs } = await adminClient
            .from("profiles")
            .select("id, name, email, phone")
            .in("id", userIds);
          profileMap = new Map((profs ?? []).map((p: { id: string; name: string; email: string; phone?: string }) => [p.id, p]));
        }

        const merged = (requests ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          profiles: profileMap.get(r.user_id as string) ?? null,
        }));

        return jsonResponse(200, { requests: merged });
      }

      case "verify-upi-payment": {
        // Super admin verifies a UPI payment and issues a license or hub-add credit
        if (!isSuperAdmin) return jsonError(403, "Only Super Admins can verify payments");
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body = await req.json() as { request_id: string; approved: boolean; rejection_reason?: string };
        if (!body.request_id) return jsonError(400, "request_id is required");

        const { data: reqRow } = await adminClient
          .from("license_payment_requests")
          .select("*")
          .eq("id", body.request_id)
          .maybeSingle();

        if (!reqRow) return jsonError(404, "Payment request not found");
        if (reqRow.status !== "pending") return jsonError(400, "This request has already been processed");

        const requestType = reqRow.request_type || "license";

        if (body.approved) {
          const now = new Date().toISOString();

          if (requestType === "hub_add") {
            // Grant a hub-add credit to the user — atomic increment
            const { error: incErr } = await adminClient
              .rpc("increment_hub_credit", { p_user_id: reqRow.user_id, p_amount: 1 });

            if (incErr) {
              return jsonError(500, "Failed to grant hub credit: " + incErr.message);
            }

            await adminClient.from("license_payment_requests").update({
              status: "verified",
              verified_at: now,
              verified_by: callerUser.user.id,
            }).eq("id", body.request_id);

            await adminClient.from("audit_logs").insert({
              action: "hub_add_payment_verified",
              performed_by: callerUser.user.id,
              target_user_id: reqRow.user_id,
              details: `Hub-add payment verified (TXN: ${reqRow.transaction_id}) — 1 hub credit granted`,
            });

            // Credit 50% commission to referrer if applicable
            await creditReferralCommission(adminClient, reqRow.user_id, Number(reqRow.amount) || 0, callerUser.user.id);

            return jsonResponse(200, { message: "Hub-add payment verified — 1 hub credit granted to user" });
          } else {
            // Generate/activate license for the user
            const targetPlan = reqRow.plan_type === "monthly" ? "monthly" : "lifetime";
            const licCode = await createLicenseForUser(adminClient, reqRow.user_id, targetPlan);

            // Directly activate profile upon admin verification of payment
            const { data: userProf } = await adminClient
              .from("profiles")
              .select("plan_type, subscription_started_at, subscription_expires_at, renewal_count")
              .eq("id", reqRow.user_id)
              .maybeSingle();

            if (targetPlan === "lifetime") {
              await adminClient.from("profiles").update({
                license_status: "activated",
                license_activated_at: now,
                license_expires_at: null,
                plan_type: "lifetime",
                subscription_started_at: now,
                subscription_expires_at: null,
                subscription_status: "active",
                last_payment_at: now,
              }).eq("id", reqRow.user_id);

              await adminClient.from("license_keys").update({
                status: "activated",
                activated_at: now,
              }).eq("user_id", reqRow.user_id);

              await logSubscriptionHistory(
                adminClient,
                reqRow.user_id,
                userProf?.plan_type || null,
                "lifetime",
                userProf?.subscription_expires_at || null,
                null,
                callerUser.user.id,
                "Admin verified payment: Lifetime Plan"
              );
            } else {
              // Monthly plan
              const currentExpiry = userProf?.subscription_expires_at ? new Date(userProf.subscription_expires_at) : null;
              const isCurrentlyActive = currentExpiry && currentExpiry > new Date();

              let newExpiryDate: Date;
              let startedAt: string;

              if (isCurrentlyActive && currentExpiry) {
                newExpiryDate = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
                startedAt = userProf?.subscription_started_at || now;
              } else {
                newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                startedAt = now;
              }

              const newExpiryStr = newExpiryDate.toISOString();
              const renewalCount = (userProf?.renewal_count || 0) + 1;

              await adminClient.from("profiles").update({
                license_status: "activated",
                license_activated_at: now,
                license_expires_at: newExpiryStr,
                plan_type: "monthly",
                subscription_started_at: startedAt,
                subscription_expires_at: newExpiryStr,
                subscription_status: "active",
                last_payment_at: now,
                next_billing_at: newExpiryStr,
                renewal_count: renewalCount,
              }).eq("id", reqRow.user_id);

              await adminClient.from("license_keys").update({
                status: "activated",
                activated_at: now,
              }).eq("user_id", reqRow.user_id);

              await logSubscriptionHistory(
                adminClient,
                reqRow.user_id,
                userProf?.plan_type || null,
                "monthly",
                userProf?.subscription_expires_at || null,
                newExpiryStr,
                callerUser.user.id,
                isCurrentlyActive ? "Admin verified payment: Extended monthly plan by 30 days" : "Admin verified payment: Activated monthly plan (30 days)"
              );
            }

            await adminClient.from("license_payment_requests").update({
              status: "verified",
              verified_at: now,
              verified_by: callerUser.user.id,
              license_code: licCode,
            }).eq("id", body.request_id);

            await adminClient.from("audit_logs").insert({
              action: "license_payment_verified",
              performed_by: callerUser.user.id,
              target_user_id: reqRow.user_id,
              details: `UPI payment verified (TXN: ${reqRow.transaction_id}) — ${targetPlan} plan activated`,
            });

            await creditReferralCommission(adminClient, reqRow.user_id, Number(reqRow.amount) || 0, callerUser.user.id);

            return jsonResponse(200, { license_code: licCode, message: `Payment verified and ${targetPlan} plan activated` });
          }
        } else {
          // Reject
          await adminClient.from("license_payment_requests").update({
            status: "rejected",
            verified_at: new Date().toISOString(),
            verified_by: callerUser.user.id,
            rejection_reason: body.rejection_reason?.trim() || "Payment could not be verified",
          }).eq("id", body.request_id);

          await adminClient.from("audit_logs").insert({
            action: "license_payment_rejected",
            performed_by: callerUser.user.id,
            target_user_id: reqRow.user_id,
            details: `UPI payment rejected (TXN: ${reqRow.transaction_id})`,
          });

          return jsonResponse(200, { message: "Payment request rejected" });
        }
      }

      case "admin-convert-plan": {
        if (!isSuperAdmin) return jsonError(403, "Only Super Admins can convert plans");
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body = await req.json() as { user_id: string; target_plan: "lifetime" | "monthly" };
        if (!body.user_id || !body.target_plan) return jsonError(400, "user_id and target_plan are required");

        const { data: targetProf } = await adminClient
          .from("profiles")
          .select("id, name, plan_type, subscription_expires_at, renewal_count")
          .eq("id", body.user_id)
          .maybeSingle();

        if (!targetProf) return jsonError(404, "User not found");

        const now = new Date().toISOString();
        if (body.target_plan === "lifetime") {
          await adminClient.from("profiles").update({
            plan_type: "lifetime",
            subscription_status: "active",
            subscription_started_at: now,
            subscription_expires_at: null,
            license_status: "activated",
            license_expires_at: null,
          }).eq("id", body.user_id);

          await adminClient.from("license_keys").update({
            plan_type: "lifetime",
            status: "activated",
          }).eq("user_id", body.user_id);

          await logSubscriptionHistory(
            adminClient,
            body.user_id,
            targetProf.plan_type || null,
            "lifetime",
            targetProf.subscription_expires_at || null,
            null,
            callerUser.user.id,
            "Admin converted plan to Lifetime"
          );
        } else {
          // Monthly
          const newExpiryStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await adminClient.from("profiles").update({
            plan_type: "monthly",
            subscription_status: "active",
            subscription_started_at: now,
            subscription_expires_at: newExpiryStr,
            license_status: "activated",
            license_expires_at: newExpiryStr,
            next_billing_at: newExpiryStr,
          }).eq("id", body.user_id);

          await adminClient.from("license_keys").update({
            plan_type: "monthly",
            status: "activated",
          }).eq("user_id", body.user_id);

          await logSubscriptionHistory(
            adminClient,
            body.user_id,
            targetProf.plan_type || null,
            "monthly",
            targetProf.subscription_expires_at || null,
            newExpiryStr,
            callerUser.user.id,
            "Admin converted plan to Monthly (30 days)"
          );
        }

        await adminClient.from("audit_logs").insert({
          action: "admin_plan_converted",
          performed_by: callerUser.user.id,
          target_user_id: body.user_id,
          details: `Converted ${targetProf.name}'s plan to ${body.target_plan}`,
        });

        return jsonResponse(200, { message: `Plan converted to ${body.target_plan}` });
      }

      case "admin-renew-subscription": {
        if (!isSuperAdmin) return jsonError(403, "Only Super Admins can renew subscriptions");
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body = await req.json() as { user_id: string };
        if (!body.user_id) return jsonError(400, "user_id is required");

        const { data: targetProf } = await adminClient
          .from("profiles")
          .select("id, name, plan_type, subscription_expires_at, subscription_started_at, renewal_count")
          .eq("id", body.user_id)
          .maybeSingle();

        if (!targetProf) return jsonError(404, "User not found");

        const now = new Date().toISOString();
        const currentExpiry = targetProf.subscription_expires_at ? new Date(targetProf.subscription_expires_at) : null;
        const isCurrentlyActive = currentExpiry && currentExpiry > new Date();

        let newExpiryDate: Date;
        if (isCurrentlyActive && currentExpiry) {
          newExpiryDate = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        const newExpiryStr = newExpiryDate.toISOString();
        const renewalCount = (targetProf.renewal_count || 0) + 1;

        await adminClient.from("profiles").update({
          plan_type: "monthly",
          subscription_status: "active",
          subscription_started_at: targetProf.subscription_started_at || now,
          subscription_expires_at: newExpiryStr,
          license_status: "activated",
          license_expires_at: newExpiryStr,
          last_payment_at: now,
          next_billing_at: newExpiryStr,
          renewal_count: renewalCount,
        }).eq("id", body.user_id);

        await adminClient.from("license_keys").update({
          plan_type: "monthly",
          status: "activated",
        }).eq("user_id", body.user_id);

        await logSubscriptionHistory(
          adminClient,
          body.user_id,
          targetProf.plan_type || "monthly",
          "monthly",
          targetProf.subscription_expires_at || null,
          newExpiryStr,
          callerUser.user.id,
          isCurrentlyActive ? "Admin renewed subscription (+30 days extended)" : "Admin renewed subscription (30 days from now)"
        );

        await adminClient.from("audit_logs").insert({
          action: "admin_subscription_renewed",
          performed_by: callerUser.user.id,
          target_user_id: body.user_id,
          details: `Renewed monthly subscription for ${targetProf.name} (new expiry: ${newExpiryStr})`,
        });

        return jsonResponse(200, { message: "Subscription renewed successfully", expires_at: newExpiryStr });
      }

      case "disable-gift-card": {
        // Super admin disables a gift card
        if (!isSuperAdmin) return jsonError(403, "Only Super Admins can disable gift cards");
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body = await req.json() as { card_id: string };
        if (!body.card_id) return jsonError(400, "card_id is required");

        const { error: updErr } = await adminClient.from("gift_cards")
          .update({ status: "disabled" })
          .eq("id", body.card_id)
          .eq("status", "available");

        if (updErr) return jsonError(500, "Failed to disable gift card: " + updErr.message);

        return jsonResponse(200, { message: "Gift card disabled" });
      }

      case "apply-referral-code": {
        // User applies a referral/promo code — links them to the referrer
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body = await req.json() as { code: string };
        if (!body.code?.trim()) return jsonError(400, "Referral code is required");

        const code = body.code.trim().toUpperCase();

        // Check if user already has a referrer
        const { data: myProfile } = await adminClient
          .from("profiles")
          .select("id, referral_code, referred_by")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        if (!myProfile) return jsonError(404, "Profile not found");
        if (myProfile.referred_by) return jsonError(400, "You have already applied a referral code");

        // Can't use your own code
        if (myProfile.referral_code === code) return jsonError(400, "You cannot use your own referral code");

        // Find the referrer
        const { data: referrer } = await adminClient
          .from("profiles")
          .select("id, name, referral_code")
          .eq("referral_code", code)
          .maybeSingle();

        if (!referrer) return jsonError(404, "Invalid referral code. Please check and try again.");

        // Link the referral
        await adminClient.from("profiles")
          .update({ referred_by: referrer.id })
          .eq("id", callerUser.user.id);

        // Create referral record
        await adminClient.from("referrals").insert({
          referrer_id: referrer.id,
          referee_id: callerUser.user.id,
          referral_code: code,
          status: "pending",
        });

        await adminClient.from("audit_logs").insert({
          action: "referral_code_applied",
          performed_by: callerUser.user.id,
          target_user_id: referrer.id,
          details: `Applied referral code ${code} from ${referrer.name}`,
        });

        return jsonResponse(200, { message: `Referral code applied successfully! You were referred by ${referrer.name}.` });
      }

      case "get-referral-stats": {
        // Get referral stats for the caller
        const { data: myProfile } = await adminClient
          .from("profiles")
          .select("id, referral_code, referral_earnings")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        if (!myProfile) return jsonError(404, "Profile not found");

        // Get all referrals made by this user with referee details
        const { data: referrals } = await adminClient
          .from("referrals")
          .select("id, referee_id, status, commission_amount, earned_at, created_at")
          .eq("referrer_id", callerUser.user.id)
          .order("created_at", { ascending: false });

        // Fetch referee profiles
        const refereeIds = [...new Set((referrals ?? []).map((r: { referee_id: string }) => r.referee_id))];
        let refereeMap = new Map<string, { name: string; email: string }>();
        if (refereeIds.length > 0) {
          const { data: profiles } = await adminClient
            .from("profiles")
            .select("id, name, email")
            .in("id", refereeIds);
          refereeMap = new Map((profiles ?? []).map((p: { id: string; name: string; email: string }) => [p.id, p]));
        }

        const merged = (referrals ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          referee: refereeMap.get(r.referee_id as string) ?? null,
        }));

        return jsonResponse(200, {
          referral_code: myProfile.referral_code,
          total_referrals: (referrals ?? []).length,
          total_earnings: Number(myProfile.referral_earnings) || 0,
          referrals: merged,
        });
      }

      case "request-withdrawal": {
        // User requests a commission withdrawal with bank details
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body = await req.json() as {
          amount: number;
          bank_account_name: string;
          bank_account_number: string;
          bank_ifsc: string;
          bank_name: string;
          upi_id?: string;
        };

        if (!body.amount || body.amount <= 0) return jsonError(400, "Valid withdrawal amount is required");
        if (!body.bank_account_name?.trim()) return jsonError(400, "Bank account holder name is required");
        if (!body.bank_account_number?.trim()) return jsonError(400, "Bank account number is required");
        if (!body.bank_ifsc?.trim()) return jsonError(400, "Bank IFSC code is required");
        if (!body.bank_name?.trim()) return jsonError(400, "Bank name is required");

        // Check user's available earnings
        const { data: myProfile } = await adminClient
          .from("profiles")
          .select("id, referral_earnings, name, email")
          .eq("id", callerUser.user.id)
          .maybeSingle();

        if (!myProfile) return jsonError(404, "Profile not found");

        const availableEarnings = Number(myProfile.referral_earnings) || 0;
        if (availableEarnings < body.amount) {
          return jsonError(400, `Insufficient balance. Your available earnings are ₹${availableEarnings.toFixed(2)}`);
        }

        // Check for pending withdrawals
        const { data: pendingWd } = await adminClient
          .from("withdrawal_requests")
          .select("id")
          .eq("user_id", callerUser.user.id)
          .eq("status", "pending")
          .maybeSingle();

        if (pendingWd) return jsonError(400, "You already have a pending withdrawal request. Please wait for it to be processed.");

        // Insert withdrawal request
        const { data: withdrawal, error: wdErr } = await adminClient.from("withdrawal_requests").insert({
          user_id: callerUser.user.id,
          amount: body.amount,
          bank_account_name: body.bank_account_name.trim(),
          bank_account_number: body.bank_account_number.trim(),
          bank_ifsc: body.bank_ifsc.trim().toUpperCase(),
          bank_name: body.bank_name.trim(),
          upi_id: body.upi_id?.trim() || null,
          status: "pending",
        }).select().single();

        if (wdErr || !withdrawal) return jsonError(500, "Failed to create withdrawal request: " + (wdErr?.message ?? "unknown"));

        // Atomically decrement the user's available earnings.
        // The gte condition prevents the balance from going negative if a
        // concurrent request slipped through between the balance check above
        // and this update.
        const { data: decResult, error: decErr } = await adminClient.rpc("decrement_referral_earnings", {
          p_user_id: callerUser.user.id,
          p_amount: body.amount,
        });

        if (decErr || decResult === false) {
          // Balance was insufficient (race) — roll back the withdrawal insert
          await adminClient.from("withdrawal_requests").delete().eq("id", withdrawal.id);
          return jsonError(400, "Insufficient balance. Your available earnings may have changed.");
        }

        await adminClient.from("audit_logs").insert({
          action: "withdrawal_requested",
          performed_by: callerUser.user.id,
          target_user_id: callerUser.user.id,
          details: `Withdrawal request of ₹${body.amount} to ${body.bank_name} (A/C: ${body.bank_account_number.slice(-4).padStart(body.bank_account_number.length, '*')})`,
        });

        return jsonResponse(200, {
          message: "Withdrawal request submitted successfully! Your commission will be transferred within 7 days.",
          withdrawal_id: withdrawal.id,
        });
      }

      case "get-withdrawals": {
        // Get user's withdrawal history
        const { data: withdrawals } = await adminClient
          .from("withdrawal_requests")
          .select("*")
          .eq("user_id", callerUser.user.id)
          .order("created_at", { ascending: false });

        return jsonResponse(200, { withdrawals: withdrawals ?? [] });
      }

      case "admin-list-payouts": {
        if (!isSuperAdmin) return jsonError(403, "Only super admin can manage payouts");

        const { data: withdrawals2 } = await adminClient
          .from("withdrawal_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

        const userIds2 = [...new Set((withdrawals2 ?? []).map((w: { user_id: string }) => w.user_id))];
        let profileMap2 = new Map<string, { name: string; email: string; phone?: string }>();
        if (userIds2.length > 0) {
          const { data: profs2 } = await adminClient
            .from("profiles")
            .select("id, name, email, phone, referral_code, referral_earnings")
            .in("id", userIds2);
          profileMap2 = new Map((profs2 ?? []).map((p: { id: string }) => [p.id, p]));
        }

        const merged2 = (withdrawals2 ?? []).map((w: Record<string, unknown>) => ({
          ...w,
          user: profileMap2.get(w.user_id as string) ?? null,
        }));

        const pendingCount = (merged2 as Record<string, unknown>[]).filter((w) => w.status === "pending").length;
        const processedCount = (merged2 as Record<string, unknown>[]).filter((w) => w.status === "processed").length;
        const totalPaidOut = (merged2 as Record<string, unknown>[])
          .filter((w) => w.status === "processed")
          .reduce((sum, w) => sum + Number(w.amount), 0);
        const totalPendingAmount = (merged2 as Record<string, unknown>[])
          .filter((w) => w.status === "pending")
          .reduce((sum, w) => sum + Number(w.amount), 0);

        return jsonResponse(200, {
          withdrawals: merged2,
          stats: {
            total: merged2.length,
            pending: pendingCount,
            processed: processedCount,
            total_paid_out: totalPaidOut,
            total_pending_amount: totalPendingAmount,
          },
        });
      }

      case "admin-list-earners": {
        if (!isSuperAdmin) return jsonError(403, "Only super admin can manage payouts");

        const { data: earners } = await adminClient
          .from("profiles")
          .select("id, name, email, phone, referral_code, referral_earnings, created_at")
          .gt("referral_earnings", 0)
          .order("referral_earnings", { ascending: false });

        const { data: referralStats } = await adminClient
          .from("referrals")
          .select("referrer_id, status, commission_amount")
          .in("referrer_id", (earners ?? []).map((e: { id: string }) => e.id));

        const statsByUser = new Map<string, { total: number; earned: number; paid: number; pending: number }>();
        for (const r of referralStats ?? []) {
          const cur = statsByUser.get(r.referrer_id) ?? { total: 0, earned: 0, paid: 0, pending: 0 };
          cur.total += 1;
          if (r.status === "commission_earned") cur.earned += 1;
          else if (r.status === "commission_paid") cur.paid += 1;
          else if (r.status === "pending") cur.pending += 1;
          statsByUser.set(r.referrer_id, cur);
        }

        const { data: wdByUser } = await adminClient
          .from("withdrawal_requests")
          .select("user_id, status, amount");

        const withdrawnByUser = new Map<string, number>();
        for (const w of wdByUser ?? []) {
          if (w.status === "processed") {
            withdrawnByUser.set(w.user_id, (withdrawnByUser.get(w.user_id) ?? 0) + Number(w.amount));
          }
        }

        const result = (earners ?? []).map((e: Record<string, unknown>) => ({
          ...e,
          referral_stats: statsByUser.get(e.id as string) ?? { total: 0, earned: 0, paid: 0, pending: 0 },
          total_withdrawn: withdrawnByUser.get(e.id as string) ?? 0,
          available_balance: Number(e.referral_earnings) || 0,
        }));

        return jsonResponse(200, { earners: result });
      }

      case "admin-process-withdrawal": {
        if (!isSuperAdmin) return jsonError(403, "Only super admin can manage payouts");
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body3 = await req.json() as { withdrawal_id: string; admin_notes?: string };
        if (!body3.withdrawal_id) return jsonError(400, "Withdrawal ID is required");

        const { data: wd } = await adminClient
          .from("withdrawal_requests")
          .select("*")
          .eq("id", body3.withdrawal_id)
          .maybeSingle();

        if (!wd) return jsonError(404, "Withdrawal request not found");
        if (wd.status !== "pending") return jsonError(400, "This withdrawal has already been processed");

        const { error: updErr } = await adminClient.from("withdrawal_requests")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            processed_by: callerUser.user.id,
            admin_notes: body3.admin_notes?.trim() || null,
          })
          .eq("id", body3.withdrawal_id);

        if (updErr) return jsonError(500, "Failed to update withdrawal: " + updErr.message);

        const wdUser = await adminClient
          .from("profiles")
          .select("name, email")
          .eq("id", wd.user_id)
          .maybeSingle();

        await adminClient.from("audit_logs").insert({
          action: "withdrawal_processed",
          performed_by: callerUser.user.id,
          target_user_id: wd.user_id,
          details: `Processed withdrawal of ₹${wd.amount} to ${wd.bank_name} (A/C: ${wd.bank_account_number.slice(-4)}) for ${wdUser.data?.name ?? "user"}`,
        });

        return jsonResponse(200, { message: "Withdrawal marked as paid successfully" });
      }

      case "admin-reject-withdrawal": {
        if (!isSuperAdmin) return jsonError(403, "Only super admin can manage payouts");
        if (req.method !== "POST") return jsonError(405, "Method not allowed");

        const body4 = await req.json() as { withdrawal_id: string; admin_notes?: string };
        if (!body4.withdrawal_id) return jsonError(400, "Withdrawal ID is required");

        const { data: wd2 } = await adminClient
          .from("withdrawal_requests")
          .select("*")
          .eq("id", body4.withdrawal_id)
          .maybeSingle();

        if (!wd2) return jsonError(404, "Withdrawal request not found");
        if (wd2.status !== "pending") return jsonError(400, "This withdrawal has already been processed");

        const { error: rejErr } = await adminClient.from("withdrawal_requests")
          .update({
            status: "rejected",
            processed_at: new Date().toISOString(),
            processed_by: callerUser.user.id,
            admin_notes: body4.admin_notes?.trim() || null,
          })
          .eq("id", body4.withdrawal_id);

        if (rejErr) return jsonError(500, "Failed to reject withdrawal: " + rejErr.message);

        // Refund the earnings back to user's balance
        const { data: userProfile } = await adminClient
          .from("profiles")
          .select("referral_earnings")
          .eq("id", wd2.user_id)
          .maybeSingle();

        if (userProfile) {
          const refunded = (Number(userProfile.referral_earnings) || 0) + Number(wd2.amount);
          await adminClient.from("profiles")
            .update({ referral_earnings: refunded })
            .eq("id", wd2.user_id);
        }

        await adminClient.from("audit_logs").insert({
          action: "withdrawal_rejected",
          performed_by: callerUser.user.id,
          target_user_id: wd2.user_id,
          details: `Rejected withdrawal of ₹${wd2.amount}. Reason: ${body4.admin_notes?.trim() || "N/A"}. Earnings refunded.`,
        });

        return jsonResponse(200, { message: "Withdrawal rejected and earnings refunded to user" });
      }

      default:
        return jsonError(400, "Unknown action");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonError(500, msg);
  }
});

// Credit 50% commission to the referrer when a referee's payment is verified
async function creditReferralCommission(
  adminClient: ReturnType<typeof createClient>,
  refereeId: string,
  paymentAmount: number,
  verifiedBy: string
): Promise<void> {
  try {
    // Find the referral record for this referee
    const { data: referral } = await adminClient
      .from("referrals")
      .select("id, referrer_id, status")
      .eq("referee_id", refereeId)
      .maybeSingle();

    if (!referral || referral.status !== "pending") return;

    const commission = Math.round(paymentAmount * 0.5 * 100) / 100;

    // Update referral status
    await adminClient.from("referrals")
      .update({ status: "commission_earned", commission_amount: commission, earned_at: new Date().toISOString() })
      .eq("id", referral.id);

    // Increment referrer's earnings atomically
    const { data: referrerProfile } = await adminClient
      .from("profiles")
      .select("referral_earnings")
      .eq("id", referral.referrer_id)
      .maybeSingle();

    if (referrerProfile) {
      const newEarnings = (Number(referrerProfile.referral_earnings) || 0) + commission;
      await adminClient.from("profiles")
        .update({ referral_earnings: newEarnings })
        .eq("id", referral.referrer_id);
    }

    await adminClient.from("audit_logs").insert({
      action: "referral_commission_credited",
      performed_by: verifiedBy,
      target_user_id: referral.referrer_id,
      details: `50% commission of ${paymentAmount} = ${commission} credited to referrer for referral ${referral.id}`,
    });
  } catch (err) {
    console.error("creditReferralCommission error:", err);
  }
}

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
