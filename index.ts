// ─────────────────────────────────────────
// Edge Function: submit-lead
// Deploy to: supabase/functions/submit-lead/index.ts
// ─────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')!  // e.g. leads@yourdomain.co.uk

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─────────────────────────────────────────
// CORS headers — update origin when domain is known
// ─────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─────────────────────────────────────────
// Extract outward postcode prefix
// "BS29 6AA" → "BS29"
// "BS296AA"  → "BS29"
// ─────────────────────────────────────────
function extractPostcodePrefix(postcode: string): string {
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase()
  return cleaned.slice(0, -3)
}

// ─────────────────────────────────────────
// Send email via Resend
// ─────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  return res.ok
}

// ─────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────
function tradeспersonEmail(tradesperson: any, lead: any, tradeLabel: string): string {
  return `
    <p>Hi ${tradesperson.name},</p>
    <p>You have a new lead via Somerset Home Services.</p>
    <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:480px;">
      <tr><td style="color:#6b7590;width:140px;">Name</td><td><strong>${lead.customer_name}</strong></td></tr>
      <tr><td style="color:#6b7590;">Phone</td><td><strong>${lead.customer_phone}</strong></td></tr>
      <tr><td style="color:#6b7590;">Postcode</td><td><strong>${lead.customer_postcode}</strong></td></tr>
      <tr><td style="color:#6b7590;">Trade needed</td><td><strong>${tradeLabel}</strong></td></tr>
      <tr><td style="color:#6b7590;vertical-align:top;">Message</td><td>${lead.message}</td></tr>
    </table>
    <p style="margin-top:24px;color:#6b7590;font-size:13px;">
      This lead was sent to you by Somerset Home Services. Please contact the customer directly.
    </p>
  `
}

function customerEmail(tradesperson: any, lead: any, tradeLabel: string): string {
  return `
    <p>Hi ${lead.customer_name},</p>
    <p>Thanks for getting in touch with Somerset Home Services.</p>
    <p>We've passed your details to <strong>${tradesperson.name}${tradesperson.business_name ? ` at ${tradesperson.business_name}` : ''}</strong>, 
    who will be in touch with you shortly.</p>
    <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:480px;">
      <tr><td style="color:#6b7590;width:140px;">Trade</td><td>${tradeLabel}</td></tr>
      <tr><td style="color:#6b7590;">Postcode</td><td>${lead.customer_postcode}</td></tr>
      <tr><td style="color:#6b7590;vertical-align:top;">Your message</td><td>${lead.message}</td></tr>
    </table>
    <p style="margin-top:24px;color:#6b7590;font-size:13px;">
      Somerset Home Services is free to use. You deal directly with the tradesperson for pricing and booking.
    </p>
  `
}

// ─────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────
Deno.serve(async (req) => {

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { name, phone, email, postcode, trade, message } = body

    // Basic validation
    if (!name || !phone || !email || !postcode || !trade || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const postcodePrefix = extractPostcodePrefix(postcode)

    // ── 1. Look up the trade ──────────────────────────────
    const { data: tradeRow, error: tradeError } = await supabase
      .from('trades')
      .select('id, label')
      .eq('slug', trade.toLowerCase())
      .single()

    if (tradeError || !tradeRow) {
      return new Response(JSON.stringify({ error: 'Unknown trade type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Find eligible tradespeople (rotation + postcode) ──
    // Fetch all active tradespeople for this trade who cover the postcode,
    // ordered by last_lead_sent_at ascending (NULLs first = never sent a lead)
    const { data: candidates, error: candidateError } = await supabase
      .from('tradespeople')
      .select('id, name, business_name, email, phone, price_per_lead, last_lead_sent_at')
      .eq('trade_id', tradeRow.id)
      .eq('active', true)
      .contains('postcodes', [postcodePrefix])
      .order('last_lead_sent_at', { ascending: true, nullsFirst: true })
      .limit(1)

    if (candidateError) throw candidateError

    // ── 3. Write the lead regardless (for tracking failed areas) ──
    const leadPayload = {
      customer_name:     name,
      customer_email:    email,
      customer_phone:    phone,
      customer_postcode: postcode.toUpperCase(),
      trade_id:          tradeRow.id,
      message,
      sent_to:           candidates?.[0]?.id ?? null,
      status:            candidates?.length ? 'pending' : 'failed',
      failure_reason:    candidates?.length ? null : 'No active tradesperson found for postcode',
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert(leadPayload)
      .select()
      .single()

    if (leadError) throw leadError

    // ── 4. No candidate found ────────────────────────────
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        noNetwork: true,
        tradeLabel: tradeRow.label,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tradesperson = candidates[0]

    // ── 5. Send emails ───────────────────────────────────
    const [tradespersonSent, customerSent] = await Promise.all([
      sendEmail(
        tradesperson.email,
        `New lead: ${tradeRow.label} in ${postcodePrefix}`,
        tradeспersonEmail(tradesperson, { customer_name: name, customer_email: email, customer_phone: phone, customer_postcode: postcode.toUpperCase(), message }, tradeRow.label)
      ),
      sendEmail(
        email,
        'Your request has been received — Somerset Home Services',
        customerEmail(tradesperson, { customer_name: name, customer_email: email, customer_phone: phone, customer_postcode: postcode.toUpperCase(), message }, tradeRow.label)
      ),
    ])

    // ── 6. Update lead status ────────────────────────────
    const finalStatus = tradespersonSent ? 'sent' : 'failed'
    const failureReason = tradespersonSent ? null : 'Email delivery failed'

    await supabase
      .from('leads')
      .update({ status: finalStatus, failure_reason: failureReason })
      .eq('id', lead.id)

    // ── 7. Write billing event ───────────────────────────
    if (tradespersonSent) {
      const amount = tradesperson.price_per_lead !== null
        ? tradesperson.price_per_lead
        : 0.00  // will be replaced by trade default once billing goes live

      await supabase
        .from('billing_events')
        .insert({
          tradesperson_id: tradesperson.id,
          lead_id:         lead.id,
          amount,
          billed:          false,
        })

      // ── 8. Update rotation pointer ─────────────────────
      await supabase
        .from('tradespeople')
        .update({ last_lead_sent_at: new Date().toISOString() })
        .eq('id', tradesperson.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('submit-lead error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
