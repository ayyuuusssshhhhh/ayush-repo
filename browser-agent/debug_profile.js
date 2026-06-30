const { chromium } = require('playwright');
const fs = require('fs');
const CHROMIUM_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SESSION_FILE = './zoominfo_session.json';

const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH, headless: true,
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

  const saved = fs.existsSync(SESSION_FILE) ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) : [];
  if (saved.length) { await ctx.addCookies(saved); console.log('Loaded', saved.length, 'cookies'); }

  const page = await ctx.newPage();

  // Login
  await page.goto('https://app.zoominfo.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3000);
  console.log('Initial URL:', page.url());

  if (page.url().includes('login') || page.url().includes('signin')) {
    console.log('Logging in...');

    // Dismiss cookie consent banner first
    const allowCookies = await page.$('button#onetrust-accept-btn-handler');
    if (allowCookies) { await allowCookies.click(); await delay(1000); console.log('Cookie banner dismissed'); }

    // Wait for visible login fields
    await page.waitForSelector('#usernameInput', { state: 'visible', timeout: 15000 });
    console.log('Filling credentials...');
    await page.fill('#usernameInput', 'ayush.grack@shorthills.ai');
    await delay(300);
    await page.fill('#pwInput', 'Sales@12345');
    await delay(300);

    // Screenshot before submit
    await page.screenshot({ path: './debug_before_submit.png' });

    // Use the visible "Log In" button (not the hidden Okta one)
    const allBtns = await page.$$('button');
    let clicked = false;
    for (const b of allBtns) {
      const t = (await b.innerText().catch(() => '')).trim().toLowerCase();
      const visible = await b.isVisible().catch(() => false);
      console.log(`Button: "${t}" visible=${visible}`);
      if (visible && (t === 'log in' || t === 'sign in')) {
        await b.click(); clicked = true;
        console.log('Clicked:', t);
        break;
      }
    }
    if (!clicked) {
      await page.focus('#pwInput');
      await page.keyboard.press('Enter');
      console.log('Pressed Enter');
    }
    await delay(6000);
    console.log('Post-login URL:', page.url());
    await page.screenshot({ path: './debug_postlogin.png' });

    // Check for error messages
    const errorMsg = await page.evaluate(() => {
      const errEl = document.querySelector('.okta-form-infobox-error, .o-form-error-container, [data-se="o-form-error-container"], #error-container');
      return errEl ? errEl.innerText : null;
    });
    if (errorMsg) console.log('Login error:', errorMsg);

    const pageTitle = await page.title();
    const pageText = (await page.innerText('body').catch(() => '')).slice(0, 500);
    console.log('Page title:', pageTitle);
    console.log('Page text:', pageText);
  }

  // Navigate to profile
  console.log('Navigating to profile...');
  await page.goto('https://app.zoominfo.com/#/apps/profile/person/1289846420/contact-profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(8000);
  await page.screenshot({ path: './debug_profile_1.png' });
  console.log('Profile URL:', page.url());

  // Click View buttons
  const allBtns2 = await page.$$('button');
  let viewClicked = 0;
  for (const b of allBtns2) {
    const t = (await b.innerText().catch(() => '')).trim().toLowerCase();
    console.log('Button:', JSON.stringify(t));
    if (t.includes('view') || t.includes('reveal') || t.includes('show')) {
      await b.click().catch(() => {});
      viewClicked++;
      await delay(2000);
    }
  }
  console.log('Clicked', viewClicked, 'view buttons');

  await delay(3000);
  await page.screenshot({ path: './debug_profile_2.png' });

  // Scan for emails and phones
  const results = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 0) return;
      const t = (el.innerText || '').trim();
      if (t.match(/[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/) || t.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/)) {
        out.push(t);
      }
    });
    return [...new Set(out)];
  });
  console.log('Contact data found:', JSON.stringify(results));

  // All text
  const txt = (await page.innerText('body').catch(() => '')).slice(0, 3000);
  console.log('\nPage text:\n', txt);

  const cookies = await ctx.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
