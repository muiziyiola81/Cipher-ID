// =============================================================================
// CipherID — Secure Server-Side Owner-Admin Bootstrap Edge Function
// Path: supabase/functions/bootstrap-owner-admin/index.ts
// =============================================================================
// Deploy command:
//   supabase functions deploy bootstrap-owner-admin --no-verify-jwt
//
// Required Supabase Server Secrets (set via `supabase secrets set` or Dashboard):
//   OWNER_BOOTSTRAP_SECRET   — High-entropy secret string known only to the owner
//   OWNER_ADMIN_EMAIL        — The exact email address of the owner's CipherID account
//   (SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
//    automatically injected by the Supabase Edge Runtime)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-owner-bootstrap-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Constant-time string comparison to prevent timing side-channel attacks
 * when verifying the server-side bootstrap secret.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const expectedSecret = Deno.env.get('OWNER_BOOTSTRAP_SECRET') ?? '';
    const allowedOwnerEmail = (Deno.env.get('OWNER_ADMIN_EMAIL') ?? '')
      .trim()
      .toLowerCase();

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey ||
      !expectedSecret ||
      !allowedOwnerEmail
    ) {
      return new Response(
        JSON.stringify({
          error:
            'Server bootstrap secrets (OWNER_BOOTSTRAP_SECRET and OWNER_ADMIN_EMAIL) are not configured on this Supabase project.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Verify caller's Supabase Auth JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization Bearer token.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired session token.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Parse and verify the bootstrap secret (never echoed back in responses)
    const body = await req.json().catch(() => ({}));
    const providedSecret =
      typeof body?.bootstrapSecret === 'string'
        ? body.bootstrapSecret.trim()
        : (req.headers.get('x-owner-bootstrap-secret') ?? '').trim();

    if (!providedSecret || !timingSafeEqualString(providedSecret, expectedSecret)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden: invalid owner bootstrap secret.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Verify the authenticated user matches the configured owner email
    const callerEmail = (user.email ?? '').trim().toLowerCase();
    if (!callerEmail || callerEmail !== allowedOwnerEmail) {
      return new Response(
        JSON.stringify({
          error:
            'Forbidden: authenticated account does not match the designated owner account.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Perform idempotent promotion using service_role client
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: existingProfile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('id, messaging_id, is_admin, status')
      .eq('id', user.id)
      .single();

    if (profileErr || !existingProfile) {
      return new Response(
        JSON.stringify({
          error: 'Owner profile record not found in public.profiles.',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Idempotent check: if already admin, return success immediately
    if (existingProfile.is_admin === true) {
      return new Response(
        JSON.stringify({
          ok: true,
          idempotent: true,
          isAdmin: true,
          messagingId: existingProfile.messaging_id,
          message: 'Account already holds administrator privileges.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update is_admin = true via service_role (allowed by protect_profile_immutable_columns
    // when auth.role() = 'service_role' or via public.bootstrap_owner_admin RPC)
    const { data: updatedProfile, error: updateErr } = await serviceClient
      .from('profiles')
      .update({
        is_admin: true,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, messaging_id, is_admin')
      .single();

    if (updateErr || !updatedProfile) {
      return new Response(
        JSON.stringify({
          error:
            updateErr?.message ||
            'Database trigger rejected update. Ensure protect_profile_immutable_columns() permits service_role.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        idempotent: false,
        isAdmin: Boolean(updatedProfile.is_admin),
        messagingId: updatedProfile.messaging_id,
        message: 'Owner account successfully granted administrator privileges.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unexpected server error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
