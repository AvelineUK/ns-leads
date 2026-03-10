// ─────────────────────────────────────────
// Form submission
// Replace YOUR_PROJECT_REF with your Supabase project ref
// ─────────────────────────────────────────

const FUNCTION_URL = 'https://mwnmjuytoiyslhpardhr.supabase.co/functions/v1/submit-lead'

document.getElementById('lead-form').addEventListener('submit', async function (e) {
  e.preventDefault()

  const btn = this.querySelector('.btn-submit')
  const originalText = btn.textContent

  // ── Loading state ─────────────────────
  btn.textContent = 'Sending…'
  btn.disabled = true

  // ── Gather form data ──────────────────
  const payload = {
    name:     this.querySelector('[name="name"]').value.trim(),
    phone:    this.querySelector('[name="phone"]').value.trim(),
    email:    this.querySelector('[name="email"]').value.trim(),
    postcode: this.querySelector('[name="postcode"]').value.trim(),
    trade:    this.querySelector('[name="trade"]').value,
    message:  this.querySelector('[name="message"]').value.trim(),
  }

  try {
    const res = await fetch(FUNCTION_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const data = await res.json()

    if (data.success) {
      // ── Success ───────────────────────
      showMessage(this, 'success', 'Message sent — thank you! We\'ll be in touch shortly.')
      this.reset()

    } else if (data.noNetwork) {
      // ── No tradesperson in area ───────
      showMessage(this, 'warning', `Sorry, there's no ${data.tradeLabel.toLowerCase()} in our network for your postcode yet.`)
      btn.textContent = originalText
      btn.disabled = false

    } else {
      // ── Unknown error from function ───
      throw new Error('Unexpected response')
    }

  } catch (err) {
    // ── Network or server error ───────
    showMessage(this, 'error', 'Something went wrong — please try again or call us directly.')
    btn.textContent = originalText
    btn.disabled = false
  }
})

// ─────────────────────────────────────────
// Show inline message below the form
// ─────────────────────────────────────────
function showMessage(form, type, text) {
  // Remove any existing message
  const existing = form.querySelector('.form-message')
  if (existing) existing.remove()

  const colours = {
    success: { bg: '#f0faf4', border: '#2d6a4f', text: '#2d6a4f' },
    warning: { bg: '#fff8ee', border: '#c8963e', text: '#7a5a1e' },
    error:   { bg: '#fff0f0', border: '#c0392b', text: '#c0392b' },
  }

  const c = colours[type]
  const msg = document.createElement('p')
  msg.className = 'form-message'
  msg.textContent = text
  msg.style.cssText = `
    margin-top: 14px;
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 400;
    line-height: 1.5;
    background: ${c.bg};
    border: 1px solid ${c.border};
    color: ${c.text};
  `
  form.appendChild(msg)
}
