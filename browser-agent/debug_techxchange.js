const { chromium } = require('playwright');
const fs = require('fs');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function findChromium() {
  const candidates = [
    '/tmp/pw/chromium_headless_shell-1228/chrome-linux64/chrome',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return undefined;
}

(async () => {
  const execPath = await findChromium();
  const SESSION_FILE = './zoominfo_session.json';
  const browser = await chromium.launch({
    ...(execPath ? { executablePath: execPath } : {}),
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
      '--no-proxy-server','--ignore-certificate-errors','--window-size=1920,1080'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  await ctx.addCookies(saved);

  const page = await ctx.newPage();
  const url = 'https://app.zoominfo.com/#/apps/profile/person/5327067162/contact-profile';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(8000);

  // Screenshot
  await page.screenshot({ path: './debug_techxchange.png', fullPage: true });
  console.log('Screenshot saved');

  // Get all button texts
  const btns = await page.$$('button,[role="button"]');
  console.log(`\nFound ${btns.length} buttons:`);
  for (const b of btns) {
    const t = (await b.innerText().catch(() => '')).trim();
    const vis = await b.isVisible().catch(() => false);
    if (vis && t) console.log(`  [VISIBLE] "${t}"`);
  }

  // Get page text excerpt
  const text = (await page.innerText('body').catch(() => '')).substring(0, 2000);
  console.log('\nPage text (first 2000 chars):\n', text);

  // Check for email patterns
  const emailMatches = text.match(/[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g);
  console.log('\nEmail matches:', emailMatches);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
