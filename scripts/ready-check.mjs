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
    const { res, data } = await api('/api/premium/config')
    res.ok && data.priceCents === 999
      ? pass('Premium config', `${data.priceCents} ${data.currency}/${data.interval}`)
      : fail('Premium config', JSON.stringify(data))
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

  // Register free basic adult
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
    if (res.ok && data.token && data.user?.premium === false) {
      userToken = data.token
      userId = data.user.id
      pass('Register free basic adult')
    } else fail('Register free basic adult', JSON.stringify(data).slice(0, 250))
  }

  // Upload allowed on free basic
  let privateUrl = ''
  {
    const form = new FormData()
    form.append('file', new Blob([tinyJpeg()], { type: 'image/jpeg' }), 'private.jpg')
    form.append('title', 'Private basic upload')
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
      pass('Private upload on free basic')
    } else fail('Private upload on free basic', JSON.stringify(data))
  }

  {
    const { data } = await api('/api/uploads/feed')
    const leaked = (data.uploads || []).some((u) => u.url === privateUrl)
    !leaked ? pass('Private hidden from public feed') : fail('Private hidden from public feed')
  }

  // Map browse free; encounter posts gated
  {
    const { res, data } = await api('/api/map/nearby', {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    res.ok ? pass('Map browse free', `people=${(data.people || []).length}`) : fail('Map browse free', JSON.stringify(data))
  }

  {
    const { res, data } = await api('/api/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookingFor: 'Right now', lookingNote: 'hosting now' }),
    })
    res.status === 402 && data.code === 'PREMIUM_REQUIRED'
      ? pass('Right-now post blocked without Premium')
      : fail('Right-now post blocked without Premium', `${res.status} ${JSON.stringify(data)}`)
  }

  {
    const { res, data } = await api('/api/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapVisible: true }),
    })
    res.status === 402 && data.code === 'PREMIUM_REQUIRED'
      ? pass('Map appear blocked without Premium')
      : fail('Map appear blocked without Premium', `${res.status} ${JSON.stringify(data)}`)
  }

  // Activate Premium (dev)
  {
    const { res, data } = await api('/api/premium/dev-activate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })
    res.ok && data.user?.premium
      ? pass('Premium activate (dev)')
      : fail('Premium activate (dev)', JSON.stringify(data).slice(0, 250))
  }

  {
    const { res, data } = await api('/api/map/pulse', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lookingFor: 'Right now',
        lookingNote: 'Discreet car meet — say what you want',
        mapVisible: true,
      }),
    })
    res.ok && data.user?.mapVisible && data.user?.lookingNote
      ? pass('Premium right-now pulse live on map')
      : fail('Premium right-now pulse live on map', JSON.stringify(data).slice(0, 250))
  }

  {
    const { data } = await api('/api/map/nearby')
    const mine = (data.people || []).find((p) => p.id === userId)
    mine?.looking === 'Right now' && mine?.note
      ? pass('Nearby shows looking-for note', String(mine.note).slice(0, 60))
      : fail('Nearby shows looking-for note', JSON.stringify(mine || data.people?.slice(0, 1)))
  }

  // Follow another user
  let peerId = ''
  {
    const { res, data } = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `peer${stamp}@example.com`,
        password: 'password123',
        displayName: 'Peer User',
        handle: `peer${stamp}`,
        age: 24,
      }),
    })
    if (res.ok) {
      peerId = data.user.id
      pass('Register peer for follow')
    } else fail('Register peer for follow', JSON.stringify(data).slice(0, 200))
  }

  {
    const { res, data } = await api(`/api/follows/${peerId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })
    res.ok && data.following
      ? pass('Follow user on basic/premium')
      : fail('Follow user on basic/premium', JSON.stringify(data))
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
    data.stats?.premiumUsers >= 1 && data.stats?.premiumMrrCents >= 999
      ? pass('Admin stats show Premium MRR', `premium=${data.stats.premiumUsers} mrr=${data.stats.premiumMrrCents}`)
      : fail('Admin stats show Premium MRR', JSON.stringify(data.stats))
  }

  {
    const { data } = await api(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const hasPrivate = (data.uploads || []).some((u) => u.visibility === 'private')
    data.user?.premium && hasPrivate
      ? pass('Admin sees Premium profile + private album')
      : fail('Admin sees Premium profile + private album', JSON.stringify({
          premium: data.user?.premium,
          uploads: data.uploads?.length,
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
    await page.waitForSelector('.feed-page', { timeout: 8000 })
    pass('Age gate opens free feed')
  } catch (e) {
    fail('Age gate opens free feed', String(e))
  }

  try {
    await page.getByRole('link', { name: 'Nearby' }).click()
    await page.waitForSelector('.map-page', { timeout: 5000 })
    pass('Nearby map without paywall')
  } catch (e) {
    fail('Nearby map without paywall', String(e))
  }

  try {
    await page.goto(`${WEB}/#/auth`, { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Join' }).click()
    const uiStamp = Date.now()
    const inputs = page.locator('.auth-form input')
    await inputs.nth(0).fill('UI Tester')
    await inputs.nth(1).fill(`ui${uiStamp}`)
    await inputs.nth(2).fill('26')
    await inputs.nth(3).fill(`ui${uiStamp}@example.com`)
    await inputs.nth(4).fill('password123')
    await page.locator('form').getByRole('button', { name: /Join EMBER/i }).click()
    await page.waitForURL(/profile/, { timeout: 8000 })
    await page.waitForSelector('.profile-page', { timeout: 5000 })
    pass('Register → free basic profile')
  } catch (e) {
    fail('Register → free basic profile', String(e))
  }

  try {
    await page.getByRole('link', { name: /Unlock encounters|\$9\.99/i }).first().click()
    await page.waitForURL(/premium/, { timeout: 8000 })
    await page.waitForSelector('.verify-page', { timeout: 5000 })
    await page.getByRole('button', { name: /Test Premium|Go Premium/i }).click()
    await page.waitForURL(/map/, { timeout: 8000 })
    await page.waitForSelector('.pulse-composer', { timeout: 5000 })
    pass('Premium unlock → encounter map composer')
  } catch (e) {
    fail('Premium unlock → encounter map composer', String(e))
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
    const premiumBadges = await page.locator('.vis--verified').count()
    premiumBadges > 0
      ? pass('Admin users show premium badges', String(premiumBadges))
      : fail('Admin users show premium badges')
  } catch (e) {
    fail('Admin users show premium badges', String(e))
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
