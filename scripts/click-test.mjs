import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('ember-age-verified'))
  await page.reload({ waitUntil: 'networkidle' })

  const results = {}

  await page.getByRole('button', { name: 'I am 18+' }).click()
  await page.waitForTimeout(500)
  results.ageGate = (await page.locator('.feed-page').count()) > 0 ? 'PASS' : 'FAIL'

  const likeBefore = await page.locator('.rail-btn').first().innerText()
  await page.locator('.rail-btn').first().click()
  await page.waitForTimeout(200)
  const likeAfter = await page.locator('.rail-btn').first().innerText()
  results.like =
    likeBefore !== likeAfter
      ? `PASS (${likeBefore.trim()} -> ${likeAfter.trim()})`
      : `FAIL (${likeBefore.trim()})`

  await page.getByRole('link', { name: 'Nearby' }).click()
  await page.waitForTimeout(400)
  results.navNearby =
    (await page.locator('.map-page').count()) > 0
      ? 'PASS'
      : `FAIL hash=${await page.evaluate(() => location.hash)}`

  await page.getByRole('link', { name: 'Inbox' }).click()
  await page.waitForTimeout(400)
  results.navInbox = (await page.locator('.messages-page').count()) > 0 ? 'PASS' : 'FAIL'

  await page.locator('.inbox-row').first().click()
  await page.waitForTimeout(300)
  results.openThread = (await page.locator('.messages-page--thread').count()) > 0 ? 'PASS' : 'FAIL'

  if (results.openThread === 'PASS') {
    await page.getByLabel('Message').fill('playwright ping')
    await page.getByRole('button', { name: 'Send' }).click()
    await page.waitForTimeout(200)
    results.send =
      (await page.locator('.bubble--me', { hasText: 'playwright ping' }).count()) > 0
        ? 'PASS'
        : 'FAIL'
  } else {
    results.send = 'SKIP'
  }

  await page.getByRole('link', { name: 'You' }).click()
  await page.waitForTimeout(400)
  const toggle = page.locator('button.toggle')
  const before = await toggle.getAttribute('aria-pressed')
  await toggle.click()
  await page.waitForTimeout(200)
  const after = await toggle.getAttribute('aria-pressed')
  results.toggle = before !== after ? `PASS (${before} -> ${after})` : `FAIL (${before})`

  await page.getByRole('link', { name: 'Feed' }).click()
  await page.waitForTimeout(300)
  results.navFeed = (await page.locator('.feed-page').count()) > 0 ? 'PASS' : 'FAIL'

  console.log(
    JSON.stringify(
      { results, errors, hash: await page.evaluate(() => location.hash) },
      null,
      2,
    ),
  )
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
