// ─────────────────────────────────────────
// Somerset Home Services — main JS
// ─────────────────────────────────────────

const FUNCTION_URL = 'https://mwnmjuytoiyslhpardhr.supabase.co/functions/v1/submit-lead'
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bm1qdXl0b2l5c2xocGFyZGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgyNjEsImV4cCI6MjA4ODc1NDI2MX0.MF2iEeTiPmk5y7BgGDUXiHV7CKvAM5dZPxpOj2BQBIs'

// ─────────────────────────────────────────
// FAQ accordion
// ─────────────────────────────────────────
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item')
    const isOpen = item.classList.contains('open')
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'))
    if (!isOpen) item.classList.add('open')
  })
})

// ─────────────────────────────────────────
// Form submission
// ─────────────────────────────────────────
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify(payload),
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
