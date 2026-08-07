import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const API = 'http://127.0.0.1:8787'
const WEB = 'http://127.0.0.1:5173'
const results = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text.slice(0, 200) }
  }
  return { res, data }
}

function tinyJpeg() {
  return Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103011100021101031101ffc40014000100000000000000000000000000000000ffc40014100100000000000000000000000000000000ffda000c0301000210031000003f00bf80ffd9',
    'hex',
  )
}

async function main() {
  const stamp = Date.now()

  {
    const { res, data } = await api('/api/health')
    res.ok && data.ok ? pass('API health') : fail('API health', JSON.stringify(data))
  }

  {
    const { res, data } = await api('/api/verify/config')
    res.ok && data.priceCents === 699
      ? pass('Verify config', `${data.priceCents} ${data.currency}`)
      : fail('Verify config', JSON.stringify(data))
  }

  // Under-18 register blocked
  {
    const { res } = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `kid${stamp}@example.com`,
        password: 'password123',
        displayName: 'Kid',
        handle: `kid${stamp}`,
        age: 17,
      }),
    })
    res.status === 400 ? pass('Block under-18 register') : fail('Block under-18 register', String(res.status))
  }

  // Register adult
  let userToken = ''
  let userId = ''
  {
    const { res, data } = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `ready${stamp}@example.com`,
        password: 'password123',
        displayName: 'Ready User',
        handle: `ready${stamp}`,
        age: 25,
      }),
    })
    if (res.ok && data.token && data.user?.ageVerified === false) {
      userToken = data.token
      userId = data.user.id
      pass('Register unverified adult')
    } else fail('Register unverified adult', JSON.stringify(data).slice(0, 250))
  }

  // Upload blocked before verify
  {
    const form = new FormData()
    form.append('file', new Blob([tinyJpeg()], { type: 'image/jpeg' }), 'x.jpg')
    form.append('title', 'blocked')
    form.append('visibility', 'private')
    const res = await fetch(`${API}/api/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: form,
    })
    const data = await res.json()
    res.status === 402 && data.code === 'AGE_VERIFY_REQUIRED'
      ? pass('Uploads blocked until paid verify')
      : fail('Uploads blocked until paid verify', `${res.status} ${JSON.stringify(data)}`)
  }

  // Underage DOB blocked
  {
    const { res, data } = await api('/api/verify/dev-complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthdate: '2012-01-01' }),
    })
    res.status === 400 ? pass('Block underage DOB on verify') : fail('Block underage DOB on verify', JSON.stringify(data))
  }

  // Paid verify (dev)
  {
    const { res, data } = await api('/api/verify/dev-complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthdate: '1995-06-15' }),
    })
    res.ok && data.user?.ageVerified
      ? pass('Paid age verify (dev)')
      : fail('Paid age verify (dev)', JSON.stringify(data).slice(0, 250))
  }

  // Upload allowed after verify
  let privateUrl = ''
  {
    const form = new FormData()
    form.append('file', new Blob([tinyJpeg()], { type: 'image/jpeg' }), 'private.jpg')
    form.append('title', 'Private after verify')
    form.append('visibility', 'private')
    form.append('caption', 'admin should see')
    const res = await fetch(`${API}/api/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: form,
    })
    const data = await res.json()
    if (res.ok && data.upload?.visibility === 'private') {
      privateUrl = data.upload.url
      pass('Private upload after verify')
    } else fail('Private upload after verify', JSON.stringify(data))
  }

  {
    const { data } = await api('/api/uploads/feed')
    const leaked = (data.uploads || []).some((u) => u.url === privateUrl)
    !leaked ? pass('Private hidden from public feed') : fail('Private hidden from public feed')
  }

  // Admin checks
  let adminToken = ''
  {
    const { res, data } = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ember.app', password: 'ember-admin-change-me' }),
    })
    if (res.ok) {
      adminToken = data.token
      pass('Admin login')
    } else fail('Admin login')
  }

  {
    const { data } = await api('/api/admin/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    data.stats?.verifiedUsers >= 1 && data.stats?.verifyRevenueCents >= 699
      ? pass('Admin stats show verified + revenue', `verified=${data.stats.verifiedUsers} revenue=${data.stats.verifyRevenueCents}`)
      : fail('Admin stats show verified + revenue', JSON.stringify(data.stats))
  }

  {
    const { data } = await api(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const hasPrivate = (data.uploads || []).some((u) => u.visibility === 'private')
    const hasVerify = (data.verifications || []).some((v) => v.status === 'paid')
    data.user?.ageVerified && hasPrivate && hasVerify
      ? pass('Admin sees profile, private album, verify payment')
      : fail('Admin sees profile, private album, verify payment', JSON.stringify({
          ageVerified: data.user?.ageVerified,
          uploads: data.uploads?.length,
          verifications: data.verifications,
        }).slice(0, 300))
  }

  {
    const { res } = await api('/api/admin/overview', {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    res.status === 403 ? pass('Member blocked from admin API') : fail('Member blocked from admin API', String(res.status))
  }

  // UI journey
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto(WEB, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  try {
    await page.getByRole('button', { name: 'I am 18+' }).click()
    await page.waitForTimeout(500)
    // Without auth, feed should redirect to auth
    await page.waitForURL(/auth|verify|\//, { timeout: 5000 })
    const hash = await page.evaluate(() => location.hash)
    // RequirePaidAge redirects unauthenticated to /auth
    hash.includes('auth') || (await page.locator('.auth-page, .feed-page, .verify-page').count()) > 0
      ? pass('Age gate opens app', hash)
      : fail('Age gate opens app', hash)
  } catch (e) {
    fail('Age gate opens app', String(e))
  }

  // If landed on feed somehow without auth, go profile/auth manually
  try {
    if (!(await page.locator('.auth-page').count())) {
      await page.goto(`${WEB}/#/auth`, { waitUntil: 'networkidle' })
    }
    const uiStamp = Date.now()
    await page.getByRole('tab', { name: 'Join' }).click()
    await page.locator('label:has-text("Display name") input, input').nth(0).fill('UI Tester')
    // fill form fields more reliably
    const inputs = page.locator('.auth-form input')
    await inputs.nth(0).fill('UI Tester')
    await inputs.nth(1).fill(`ui${uiStamp}`)
    await inputs.nth(2).fill('26')
    await inputs.nth(3).fill(`ui${uiStamp}@example.com`)
    await inputs.nth(4).fill('password123')
    await page.locator('form').getByRole('button', { name: /Join EMBER/i }).click()
    await page.waitForURL(/verify/, { timeout: 8000 })
    await page.waitForSelector('.verify-page', { timeout: 5000 })
    pass('Register → verify page')
  } catch (e) {
    fail('Register → verify page', String(e))
  }

  try {
    await page.locator('input[type="date"]').fill('1994-04-04')
    await page.getByRole('button', { name: /Test verify/i }).click()
    await page.waitForURL(/#\/?$/, { timeout: 8000 })
    await page.waitForSelector('.feed-page', { timeout: 8000 })
    pass('Verify → feed unlocked')
  } catch (e) {
    fail('Verify → feed unlocked', String(e))
  }

  try {
    await page.getByRole('link', { name: 'Nearby' }).click()
    await page.waitForSelector('.map-page', { timeout: 5000 })
    pass('Nearby map')
  } catch (e) {
    fail('Nearby map', String(e))
  }

  try {
    await page.getByRole('link', { name: 'Inbox' }).click()
    await page.waitForSelector('.messages-page', { timeout: 5000 })
    pass('Inbox')
  } catch (e) {
    fail('Inbox', String(e))
  }

  try {
    await page.getByRole('link', { name: 'You' }).click()
    await page.waitForSelector('.profile-page', { timeout: 5000 })
    pass('Profile')
  } catch (e) {
    fail('Profile', String(e))
  }

  // Admin UI
  try {
    await page.goto(`${WEB}/#/auth`, { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Log in' }).click()
    await page.locator('input[type="email"]').fill('admin@ember.app')
    await page.locator('input[type="password"]').fill('ember-admin-change-me')
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/admin/, { timeout: 8000 })
    await page.waitForSelector('.admin-page, .admin-shell', { timeout: 8000 })
    pass('Admin hub login')
  } catch (e) {
    fail('Admin hub login', String(e))
  }

  try {
    await page.locator('.admin-nav').getByRole('link', { name: 'Users' }).click()
    await page.waitForSelector('.admin-table tbody tr', { timeout: 5000 })
    await page.waitForSelector('.vis--verified', { timeout: 5000 })
    const verifiedBadges = await page.locator('.vis--verified').count()
    verifiedBadges > 0 ? pass('Admin users show verified badges', String(verifiedBadges)) : fail('Admin users show verified badges')
  } catch (e) {
    fail('Admin users show verified badges', String(e))
  }

  try {
    await page.locator('.admin-nav').getByRole('link', { name: 'Uploads' }).click()
    await page.getByRole('button', { name: 'private' }).click()
    await page.waitForTimeout(400)
    const cards = await page.locator('.admin-media-card').count()
    cards > 0 ? pass('Admin private uploads visible', `${cards}`) : fail('Admin private uploads visible')
  } catch (e) {
    fail('Admin private uploads visible', String(e))
  }

  if (pageErrors.length) fail('No page JS errors', pageErrors.join(' | '))
  else pass('No page JS errors')

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  writeFileSync('/tmp/ember-ready-check.json', JSON.stringify({ results, failed: failed.length }, null, 2))
  console.log('\nSUMMARY', { total: results.length, failed: failed.length })
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
