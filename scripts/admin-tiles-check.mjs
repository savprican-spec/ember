import { chromium } from 'playwright'

const WEB = 'http://127.0.0.1:5173'
const results = []
const pass = (n, d = '') => {
  results.push({ n, ok: true, d })
  console.log('PASS', n, d)
}
const fail = (n, d = '') => {
  results.push({ n, ok: false, d })
  console.log('FAIL', n, d)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto(WEB, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
try {
  await page.getByRole('button', { name: 'I am 18+' }).click()
  await page.waitForTimeout(400)
} catch {
  /* already verified */
}

await page.goto(`${WEB}/#/auth`, { waitUntil: 'networkidle' })
await page.getByRole('tab', { name: 'Log in' }).click()
await page.locator('input[type="email"]').fill('admin@ember.app')
await page.locator('input[type="password"]').fill('ember-admin-change-me')
await page.locator('form').getByRole('button', { name: 'Sign in' }).click()
await page.waitForURL(/admin/, { timeout: 10000 })
await page.waitForSelector('.admin-stat-tile', { timeout: 8000 })
pass('Admin overview tiles render', String(await page.locator('.admin-stat-tile').count()))

const tiles = [
  ['Users', /#\/admin\/users(?:\?|$)/],
  ['Premium', /plan=premium/],
  ['On map', /map=visible/],
  ['Uploads', /#\/admin\/uploads(?:\?|$)/],
  ['Private', /visibility=private/],
  ['Follows', /type=follow/],
  ['Open reports', /reports/],
  ['Conversations', /messages/],
  ['Messages', /messages/],
  ['Events 24h', /events/],
  ['Premium MRR', /plan=premium/],
]

for (const [label, re] of tiles) {
  await page.goto(`${WEB}/#/admin`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.admin-stat-tile', { timeout: 5000 })
  try {
    await page.locator(`a.admin-stat-tile:has(span:text-is("${label}"))`).click()
    await page.waitForTimeout(800)
    const hash = await page.evaluate(() => location.hash)
    re.test(hash) ? pass(`Tile opens: ${label}`, hash) : fail(`Tile opens: ${label}`, hash)
  } catch (e) {
    fail(`Tile opens: ${label}`, String(e))
  }
}

for (const name of ['Overview', 'Users', 'Uploads', 'Messages', 'Reports', 'Activity']) {
  try {
    await page.locator('.admin-nav').getByRole('link', { name, exact: true }).click()
    await page.waitForTimeout(600)
    const hasPage = await page.locator('.admin-page, .admin-stat-tile').count()
    hasPage > 0 ? pass(`Nav: ${name}`) : fail(`Nav: ${name}`, 'no content')
  } catch (e) {
    fail(`Nav: ${name}`, String(e))
  }
}

await page.goto(`${WEB}/#/admin/users`, { waitUntil: 'networkidle' })
try {
  await page.locator('.admin-table tbody a').first().click()
  await page.waitForURL(/admin\/users\//, { timeout: 5000 })
  pass('User row opens detail')
} catch (e) {
  fail('User row opens detail', String(e))
}

await page.goto(`${WEB}/#/admin/uploads`, { waitUntil: 'networkidle' })
try {
  await page.waitForSelector('.admin-media-card--button, .muted', { timeout: 8000 })
  const cards = await page.locator('.admin-media-card--button').count()
  if (cards > 0) {
    await page.locator('.admin-media-card--button').first().click()
    await page.waitForSelector('.admin-lightbox', { timeout: 3000 })
    pass('Upload tile opens lightbox', String(cards))
    await page.locator('.admin-lightbox__panel').getByRole('button', { name: 'Close' }).click()
  } else fail('Upload tile opens lightbox', 'no uploads rendered')
} catch (e) {
  fail('Upload tile opens lightbox', String(e))
}

await page.goto(`${WEB}/#/admin/messages`, { waitUntil: 'networkidle' })
try {
  await page.waitForSelector('.admin-table tbody .linkish, .muted', { timeout: 8000 })
  const rows = await page.locator('.admin-table tbody .linkish').count()
  if (rows > 0) {
    await page.locator('.admin-table tbody .linkish').first().click()
    await page.waitForTimeout(1000)
    const hash = await page.evaluate(() => location.hash)
    hash.includes('c=')
      ? pass('Messages conversation opens', hash)
      : fail('Messages conversation opens', hash)
  } else fail('Messages conversation opens', 'no conversations rendered')
} catch (e) {
  fail('Messages conversation opens', String(e))
}

await page.goto(`${WEB}/#/admin/reports?status=all`, { waitUntil: 'networkidle' })
try {
  await page.waitForSelector('.admin-table', { timeout: 5000 })
  pass('Reports page functional')
} catch (e) {
  fail('Reports page functional', String(e))
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log('SUMMARY', { total: results.length, failed: failed.length })
if (failed.length) process.exit(1)
