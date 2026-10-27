// Chụp một route của app ở độ rộng 1440 (mặc định) → PNG.
// Dùng: node tools/shot.mjs <route> <out.png> [--w 1440] [--h 1024] [--full] [--port 5199]
// Modal mở bằng query: /herd-entry/new?m=excel
import { chromium } from 'playwright-core'
import os from 'node:os'

const args = process.argv.slice(2)
const route = args[0]
const out = args[1]
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const w = Number(opt('--w', 1440))
const h = Number(opt('--h', 1024))
const port = opt('--port', '5199')
const full = args.includes('--full')

const exe = `${os.homedir()}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`
const browser = await chromium.launch({ executablePath: exe })
const page = await browser.newPage({ viewport: { width: w, height: h } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push(m.text()))
await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)
await page.screenshot({ path: out, fullPage: full })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
await browser.close()
console.log(JSON.stringify({ out, w, overflowX: overflow, errors }))
