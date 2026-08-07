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
    data = { raw: text }
  }
  return { res, data }
}

async function main() {
  // Health
  {
    const { res, data } = await api('/api/health')
    res.ok && data.ok ? pass('API health') : fail('API health', JSON.stringify(data))
  }

  // Admin login
  let adminToken = ''
  {
    const { res, data } = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ember.app', password: 'ember-admin-change-me' }),
    })
    if (res.ok && data.token && data.user?.role === 'admin') {
      adminToken = data.token
      pass('Admin login')
    } else fail('Admin login', JSON.stringify(data))
  }

  // Register unique user
  const stamp = Date.now()
  let userToken = ''
  let userId = ''
  {
    const { res, data } = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `user${stamp}@example.com`,
        password: 'password123',
        displayName: 'Launch Tester',
        handle: `tester${stamp}`,
        age: 24,
      }),
    })
    if (res.ok && data.token) {
      userToken = data.token
      userId = data.user.id
      pass('User register', data.user.handle)
    } else fail('User register', JSON.stringify(data))
  }

  // Reject underage
  {
    const { res, data } = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `kid${stamp}@example.com`,
        password: 'password123',
        displayName: 'Nope',
        handle: `kid${stamp}`,
        age: 17,
      }),
    })
    res.status === 400 ? pass('Reject under-18 register') : fail('Reject under-18 register', JSON.stringify(data))
  }

  // Private upload
  let privateUrl = ''
  {
    const jpeg = Buffer.from(
      'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103011100021101031101ffc40014000100000000000000000000000000000000ffc40014100100000000000000000000000000000000ffda000c0301000210031000003f00bf80ffd9',
      'hex',
    )
    const form = new FormData()
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'private.jpg')
    form.append('title', 'Private launch clip')
    form.append('visibility', 'private')
    form.append('caption', 'should be admin-visible only')
    const res = await fetch(`${API}/api/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: form,
    })
    const data = await res.json()
    if (res.ok && data.upload?.visibility === 'private') {
      privateUrl = data.upload.url
      pass('Private upload')
    } else fail('Private upload', JSON.stringify(data))
  }

  // Public feed must NOT include private
  {
    const { data } = await api('/api/uploads/feed')
    const leaked = (data.uploads || []).some((u) => u.visibility === 'private' || u.url === privateUrl)
    !leaked ? pass('Private hidden from public feed') : fail('Private hidden from public feed')
  }

  // Anonymous cannot fetch private media
  {
    const res = await fetch(`${API}${privateUrl}`)
    res.status === 401 || res.status === 403
      ? pass('Anonymous blocked from private media', String(res.status))
      : fail('Anonymous blocked from private media', String(res.status))
  }

  // Admin can list private uploads and user profile
  {
    const { res, data } = await api('/api/admin/uploads?visibility=private', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const found = (data.uploads || []).some((u) => u.url === privateUrl)
    res.ok && found ? pass('Admin sees private uploads') : fail('Admin sees private uploads', JSON.stringify(data).slice(0, 300))
  }
  {
    const { res, data } = await api(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const found = (data.uploads || []).some((u) => u.visibility === 'private')
    res.ok && found ? pass('Admin user detail includes private album') : fail('Admin user detail includes private album')
  }

  // Non-admin blocked from admin
  {
    const { res } = await api('/api/admin/overview', {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    res.status === 403 ? pass('Non-admin blocked from admin API') : fail('Non-admin blocked from admin API', String(res.status))
  }

  // Event tracking
  {
    const { res } = await api('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ eventType: 'prelaunch_smoke', targetType: 'system', targetId: 'check' }),
    })
    res.ok ? pass('Event tracking') : fail('Event tracking')
  }

  // UI flows
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => fail('Page error', String(e)))

  await page.goto(WEB, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })

  try {
    await page.getByRole('button', { name: 'I am 18+' }).click()
    await page.waitForSelector('.feed-page', { timeout: 5000 })
    pass('Age gate → feed')
  } catch (e) {
    fail('Age gate → feed', String(e))
  }

  try {
    await page.getByRole('link', { name: 'Nearby' }).click()
    await page.waitForSelector('.map-page', { timeout: 5000 })
    pass('Navigate Nearby')
  } catch (e) {
    fail('Navigate Nearby', String(e))
  }

  try {
    await page.getByRole('link', { name: 'You' }).click()
    await page.waitForSelector('.profile-page', { timeout: 5000 })
    await page.getByRole('link', { name: /Register|Sign in/i }).first().click()
    await page.waitForSelector('.auth-page', { timeout: 5000 })
    pass('Profile → auth')
  } catch (e) {
    fail('Profile → auth', String(e))
  }

  try {
    await page.getByRole('tab', { name: 'Log in' }).click()
    await page.locator('input[type="email"]').fill('admin@ember.app')
    await page.locator('input[type="password"]').fill('ember-admin-change-me')
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/admin/, { timeout: 8000 })
    await page.waitForSelector('.admin-shell, .admin-page', { timeout: 8000 })
    pass('Admin UI login')
  } catch (e) {
    fail('Admin UI login', String(e))
  }

  try {
    await page.locator('.admin-nav').getByRole('link', { name: 'Users' }).click()
    await page.waitForSelector('.admin-table', { timeout: 5000 })
    pass('Admin users table')
  } catch (e) {
    fail('Admin users table', String(e))
  }

  try {
    await page.locator('.admin-nav').getByRole('link', { name: 'Uploads' }).click()
    await page.waitForSelector('.admin-page', { timeout: 5000 })
    await page.getByRole('button', { name: 'private' }).click()
    await page.waitForTimeout(500)
    const count = await page.locator('.admin-media-card').count()
    count > 0 ? pass('Admin private uploads UI', `${count} cards`) : fail('Admin private uploads UI', 'no cards')
  } catch (e) {
    fail('Admin private uploads UI', String(e))
  }

  try {
    await page.locator('.admin-nav').getByRole('link', { name: 'Activity' }).click()
    await page.waitForSelector('.admin-table', { timeout: 5000 })
    pass('Admin activity table')
  } catch (e) {
    fail('Admin activity table', String(e))
  }

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  writeFileSync('/tmp/ember-prelaunch.json', JSON.stringify({ results, failed: failed.length }, null, 2))
  console.log('\nSUMMARY', { total: results.length, failed: failed.length })
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
