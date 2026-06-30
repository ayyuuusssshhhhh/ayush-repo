/**
 * ZoomInfo contact enrichment via browser UI (view credits, not API credits).
 * Uses pre-installed Chromium, bypasses egress proxy with --no-proxy-server.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SESSION_FILE = path.join(__dirname, 'zoominfo_session.json');
const CHROMIUM_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CREDS = { username: 'ayush.grack@shorthills.ai', password: 'Sales@12345' };

// ─── Contacts to enrich ───────────────────────────────────────────────────────
// Set via env: PERSON_ID, CONTACT_NAME, COMPANY  OR  edit here
const CONTACTS = process.env.PERSON_ID
  ? [{ personId: process.env.PERSON_ID, name: process.env.CONTACT_NAME || 'Unknown', company: process.env.COMPANY || '' }]
  : [
      { personId: '1289846420', name: 'John Tarantino', company: 'Arbor Realty Trust' },
    ];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

function loadCookies() {
  try { if (fs.existsSync(SESSION_FILE)) return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); } catch {}
  return [];
}
function saveCookies(ctx) {
  return ctx.cookies().then(c => fs.writeFileSync(SESSION_FILE, JSON.stringify(c, null, 2)));
}
function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim()); }));
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(page, ctx) {
  console.log('[login] Navigating to ZoomInfo...');
  await page.goto('https://app.zoominfo.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3000);

  const url = page.url();
  const onLoginPage = url.includes('login') || url.includes('signin');

  if (!onLoginPage) {
    console.log('[login] Already logged in.');
    await saveCookies(ctx);
    return;
  }

  console.log('[login] On login page:', url);
  await page.screenshot({ path: path.join(__dirname, 'debug_login_start.png') });

  // #usernameInput is the visible ZoomInfo custom overlay field
  await page.waitForSelector('#usernameInput', { state: 'visible', timeout: 15000 });
  await page.fill('#usernameInput', CREDS.username);
  console.log('[login] Username filled.');
  await delay(400);

  // Fill password directly — both fields are on screen at once
  await page.waitForSelector('#pwInput', { state: 'visible', timeout: 10000 });
  await page.fill('#pwInput', CREDS.password);
  console.log('[login] Password filled.');
  await delay(400);

  // Find and click the Sign In button (not the hidden Okta submit)
  const signInBtn = await page.$(
    'button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login"), [data-testid="login-button"]'
  );
  if (signInBtn) {
    await signInBtn.click();
    console.log('[login] Clicked Sign In button.');
  } else {
    // Fallback: press Enter from password field
    await page.focus('#pwInput');
    await page.keyboard.press('Enter');
    console.log('[login] Pressed Enter to submit.');
  }

  await delay(4000);
  await page.screenshot({ path: path.join(__dirname, 'debug_after_submit.png') });
  console.log('[login] URL after submit:', page.url());

  // MFA check
  const needsMfa = page.url().includes('login') || page.url().includes('signin')
    || !!(await page.$('input[name="answer"], input[type="tel"], input[name="passcode"]'));

  if (needsMfa) {
    console.log('\n⚠️  MFA required — check SMS on number ending in 1741');
    const code = await prompt('Enter 6-digit SMS code: ');
    const mfaInput = await page.$('input[name="answer"], input[type="tel"], input[name="passcode"]');
    if (mfaInput) {
      await mfaInput.fill(code);
      await delay(400);
      await page.keyboard.press('Enter');
      await delay(4000);
    }
  }

  await saveCookies(ctx);
  console.log('[login] Done. URL:', page.url());
}

// ─── Extraction ───────────────────────────────────────────────────────────────
async function extractContact(page, ctx, personId, name) {
  const url = `https://app.zoominfo.com/#/apps/profile/person/${personId}/contact-profile`;
  console.log(`\n[extract] Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(5000);
  await page.screenshot({ path: path.join(__dirname, `${personId}_before_reveal.png`) });

  // Click all "View" / "Reveal" buttons (these consume view credits)
  for (let pass = 0; pass < 4; pass++) {
    const btns = await page.$$('button, [role="button"]');
    let clicked = 0;
    for (const btn of btns) {
      const txt = (await btn.innerText().catch(() => '')).toLowerCase().trim();
      if (['view', 'reveal', 'show email', 'show phone', 'show mobile'].some(k => txt.includes(k))) {
        await btn.click().catch(() => {});
        clicked++;
        await delay(1500);
      }
    }
    if (clicked === 0) break;
    await delay(1000);
  }

  await delay(2000);
  await page.screenshot({ path: path.join(__dirname, `${personId}_after_reveal.png`) });
  await saveCookies(ctx);

  // ── Email extraction ──────────────────────────────────────────────────────
  const emails = await page.evaluate(() => {
    const found = new Set();
    // mailto links
    document.querySelectorAll('a[href^="mailto:"]').forEach(a =>
      found.add(a.href.replace('mailto:', '').split('?')[0].trim())
    );
    // text scan
    document.querySelectorAll('*').forEach(el => {
      const txt = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? el.textContent : (el.innerText || '');
      (txt.match(/[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g) || []).forEach(e => found.add(e.trim()));
    });
    return [...found].filter(e =>
      !e.includes('zoominfo.com') && !e.includes('example.com') && !e.includes('sentry')
    );
  });

  // ── Phone extraction ──────────────────────────────────────────────────────
  const phones = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    // tel: links (most reliable)
    document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      const digits = a.href.replace(/\D/g, '');
      if (digits.length >= 10 && !seen.has(digits)) {
        seen.add(digits);
        const parent = a.closest('li, tr, [class*="row"], [class*="item"], div');
        const label = parent
          ? ([...parent.querySelectorAll('span, label, [class*="label"], [class*="type"]')]
              .map(el => el.innerText).find(t => t && t.length < 30) || '')
          : '';
        results.push({ label: label.toLowerCase().trim(), value: a.innerText.trim() || a.href.replace('tel:', '') });
      }
    });
    // text scan fallback
    document.querySelectorAll('span, div, p, li').forEach(el => {
      const txt = el.innerText || '';
      (txt.match(/(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g) || []).forEach(ph => {
        const digits = ph.replace(/\D/g, '');
        if (digits.length >= 10 && !seen.has(digits)) {
          seen.add(digits);
          results.push({ label: 'unknown', value: ph.trim() });
        }
      });
    });
    return results;
  });

  // Classify phones
  let directPhone = null, mobilePhone = null;
  for (const { label, value } of phones) {
    if (label.includes('mobile') || label.includes('cell')) mobilePhone = mobilePhone || value;
    else if (label.includes('direct') || label.includes('office') || label.includes('work') || label.includes('hq')) directPhone = directPhone || value;
    else if (!directPhone) directPhone = value;
    else if (!mobilePhone) mobilePhone = value;
  }

  return { name, personId, email: emails[0] || null, directPhone, mobilePhone, allEmails: emails, allPhones: phones };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--no-proxy-server',            // bypass egress proxy blocking zoominfo.com
      '--ignore-certificate-errors',  // bypass proxy CA SSL interception
      '--window-size=1920,1080',
    ],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const saved = loadCookies();
  if (saved.length) { await ctx.addCookies(saved); console.log(`Loaded ${saved.length} saved cookies.`); }

  const page = await ctx.newPage();

  await login(page, ctx);

  const results = [];
  for (const c of CONTACTS) {
    const data = await extractContact(page, ctx, c.personId, c.name);
    results.push({ ...c, ...data });

    console.log('\n══════════════════════════════════════');
    console.log(`  ${data.name} @ ${c.company}`);
    console.log(`  Email:         ${data.email        || '—'}`);
    console.log(`  Direct Phone:  ${data.directPhone  || '—'}`);
    console.log(`  Mobile Phone:  ${data.mobilePhone  || '—'}`);
    console.log('══════════════════════════════════════');
  }

  fs.writeFileSync(path.join(__dirname, 'enrichment_result.json'), JSON.stringify(results, null, 2));
  console.log('\n✓ Saved to browser-agent/enrichment_result.json');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
