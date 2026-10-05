/**
 * IBM TechXchange 2026 speaker enrichment via ZoomInfo UI (view credits).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const CHROMIUM_PATH = process.env.CHROMIUM_PATH
  || '/tmp/pw/chromium_headless_shell-1228/chrome-linux64/chrome'  // session-start hook installs here
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';          // pre-installed fallback
const SESSION_FILE = './zoominfo_session.json';
const delay = ms => new Promise(r => setTimeout(r, ms));

const CREDS = { username: 'ayush.grack@shorthills.ai', password: 'Sales@12345' };
const MFA_CODE = process.env.MFA_CODE || '';

// IBM TechXchange 2026 speakers
const CONTACTS_2026 = [
  { personId: '5327067162', name: 'Bill Higgins',        company: 'IBM',       title: 'VP, AI Developer Relations',          year: 2026 },
  { personId: '2356042243', name: 'Jeff Crume',          company: 'IBM',       title: 'Distinguished Engineer, AI Security', year: 2026 },
  { personId: '8827778930', name: 'Rodney Mullen',       company: 'Reality Crisis', title: 'Co-Founder / Keynote Speaker',   year: 2026 },
];

// IBM TechXchange 2025 speakers (prior year)
const CONTACTS_2025 = [
  { personId: '8076338586', name: 'Khwaja Shaik',    company: 'IBM',       title: 'Chief Technology Officer',               year: 2025 },
  { personId: '2383768444', name: 'Nicole Forsgren', company: 'Google',    title: 'Sr Director, Developer Intelligence',    year: 2025 },
  { personId: '4004021146', name: 'Dario Amodei',    company: 'Anthropic', title: 'Co-Founder & CEO',                      year: 2025 },
  { personId: '1463516663', name: 'Satya Sharma',    company: 'IBM',       title: 'IBM Fellow',                            year: 2025 },
];

const CONTACTS = [...CONTACTS_2026, ...CONTACTS_2025];

function loadCookies() {
  try { if (fs.existsSync(SESSION_FILE)) return JSON.parse(fs.readFileSync(SESSION_FILE,'utf8')); } catch {}
  return [];
}

async function findChromium() {
  const candidates = [
    '/tmp/pw/chromium_headless_shell-1228/chrome-linux64/chrome',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return undefined; // let Playwright use its default
}

(async () => {
  const execPath = await findChromium();
  console.log('Using Chromium:', execPath || 'Playwright default');

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

  const saved = loadCookies();
  if (saved.length) { await ctx.addCookies(saved); console.log(`Loaded ${saved.length} cookies`); }

  const page = await ctx.newPage();
  await page.goto('https://app.zoominfo.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3000);
  console.log('URL:', page.url());

  // ── Login if needed ────────────────────────────────────────────────────────
  if (page.url().includes('login') || page.url().includes('signin')) {
    console.log('Logging in as', CREDS.username);
    try { const cb = await page.$('button#onetrust-accept-btn-handler'); if (cb) { await cb.click(); await delay(800); } } catch {}

    await page.waitForSelector('#usernameInput', { state: 'visible', timeout: 15000 });
    await page.fill('#usernameInput', CREDS.username);
    await page.fill('#pwInput', CREDS.password);
    await delay(300);

    const btns = await page.$$('button');
    let clicked = false;
    for (const b of btns) {
      const t = (await b.innerText().catch(() => '')).trim().toLowerCase();
      if (await b.isVisible().catch(() => false) && (t === 'log in' || t === 'sign in')) {
        await b.click(); clicked = true; break;
      }
    }
    if (!clicked) { await page.focus('#pwInput'); await page.keyboard.press('Enter'); }
    await delay(4000);

    // Email MFA
    const bodyText = (await page.innerText('body').catch(() => '')).toLowerCase();
    if (bodyText.includes('email authentication') || bodyText.includes('enter code')) {
      // Dismiss cookie banner first (it blocks the Verify button)
      try {
        const cookieBtn = await page.$('button#onetrust-accept-btn-handler, button[aria-label*="Allow All"], button:has-text("Allow All Cookies")');
        if (cookieBtn && await cookieBtn.isVisible().catch(() => false)) { await cookieBtn.click(); await delay(800); }
      } catch {}
      // Also try by text
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(b => /allow all cookies/i.test(b.textContent || ''));
        if (b) b.click();
      }).catch(() => {});
      await delay(500);

      const code = MFA_CODE || (() => { throw new Error('MFA required — set MFA_CODE env var'); })();
      console.log('Entering MFA code:', code);
      // Try each individual digit input first (some MFA forms have 6 separate boxes)
      const digitInputs = await page.$$('input[maxlength="1"]');
      if (digitInputs.length >= 6) {
        for (let i = 0; i < 6; i++) { await digitInputs[i].fill(code[i]); await delay(80); }
      } else {
        const inputs = await page.$$('input[type="text"],input[type="number"],input[type="tel"],input[type="password"],input:not([type])');
        for (const inp of inputs) { if (await inp.isVisible()) { await inp.fill(code); break; } }
      }
      await delay(800);
      await page.screenshot({ path: './mfa_debug.png' });
      console.log('  Saved MFA screenshot');
      // Try Playwright click first (works when button is enabled), then dispatchEvent fallback
      let clicked2 = false;
      try {
        await page.click('button:has-text("Verify")', { timeout: 3000 });
        clicked2 = true; console.log('  Verify clicked via page.click()');
      } catch {
        const res = await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll('button,input[type="submit"]'))
            .find(b => /verify|submit|confirm|continue|next/i.test(b.textContent || b.value || ''));
          if (b) { b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return b.textContent || b.value; }
          return null;
        });
        console.log('  Verify dispatchEvent:', res);
        if (!res) { await page.keyboard.press('Enter'); console.log('  Pressed Enter'); }
        clicked2 = !!res;
      }
      await delay(6000);
    }

    const cookies = await ctx.cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
    console.log('Post-login URL:', page.url());
    if (page.url().includes('login')) { console.error('Login failed'); await browser.close(); process.exit(1); }
  } else {
    // Verify session is actually valid (not just URL-based)
    const bodyText = (await page.innerText('body').catch(() => '')).toLowerCase();
    if (bodyText.includes('session has expired') || bodyText.includes('please login') || bodyText.includes('sign up')) {
      console.log('Session expired — forcing fresh login');
      fs.unlinkSync(SESSION_FILE);
      await page.goto('https://app.zoominfo.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(2000);
      // Falls through to login block on next run — exit and re-run with MFA_CODE
      console.error('Session expired. Delete zoominfo_session.json and re-run with MFA_CODE=<code>');
      await browser.close(); process.exit(1);
    }
    console.log('Already logged in (session valid).');
    const c = await ctx.cookies(); fs.writeFileSync(SESSION_FILE, JSON.stringify(c, null, 2));
  }

  // ── Enrich each contact ────────────────────────────────────────────────────
  const results = [];
  for (const contact of CONTACTS) {
    console.log(`\nEnriching: ${contact.name} (${contact.personId})`);
    const url = `https://app.zoominfo.com/#/apps/profile/person/${contact.personId}/contact-profile`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(6000);

    // Click View/Reveal buttons
    for (let pass = 0; pass < 5; pass++) {
      let clicked = 0;
      const btns = await page.$$('button,[role="button"]');
      for (const b of btns) {
        const t = (await b.innerText().catch(() => '')).trim().toLowerCase();
        if (await b.isVisible().catch(() => false) && (t === 'view' || t === 'reveal' || t.startsWith('view ') || t.includes('show'))) {
          console.log(`  Clicking: "${t}"`);
          await b.click().catch(() => {});
          clicked++; await delay(2000);
        }
      }
      if (clicked === 0) break;
    }
    await delay(1000);

    const data = await page.evaluate(() => {
      const emails = new Set(), phones = [], seenP = new Set();
      document.querySelectorAll('a[href^="mailto:"]').forEach(a =>
        emails.add(a.href.replace('mailto:','').split('?')[0].trim()));
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length > 0) return;
        (el.innerText||'').match(/[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g)?.forEach(e => emails.add(e));
      });
      document.querySelectorAll('a[href^="tel:"]').forEach(a => {
        const d = a.href.replace(/\D/g,'');
        if (d.length >= 10 && !seenP.has(d)) {
          seenP.add(d);
          const par = a.closest('li,tr,[class*="row"],[class*="item"],div');
          const lbl = par ? ([...par.querySelectorAll('span,label,[class*="label"]')].map(el=>el.innerText).find(t=>t&&t.length<30)||'') : '';
          phones.push({ label: lbl.toLowerCase().trim(), value: a.innerText.trim()||a.href.replace('tel:','') });
        }
      });
      document.querySelectorAll('span,div,p').forEach(el => {
        (el.innerText||'').match(/(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g)?.forEach(ph => {
          const d = ph.replace(/\D/g,'');
          if (d.length >= 10 && !seenP.has(d)) { seenP.add(d); phones.push({ label:'unknown', value: ph.trim() }); }
        });
      });
      return {
        emails: [...emails].filter(e => !e.includes('zoominfo.com') && !e.includes('example.com') && e.includes('@')),
        phones
      };
    });

    let direct = null, mobile = null;
    for (const { label, value } of data.phones) {
      if (label.includes('mobile')||label.includes('cell')) mobile = mobile||value;
      else if (label.includes('direct')||label.includes('office')||label.includes('work')) direct = direct||value;
      else if (!direct) direct = value; else if (!mobile) mobile = value;
    }

    const out = { ...contact, email: data.emails[0]||null, directPhone: direct, mobilePhone: mobile };
    results.push(out);

    console.log('══════════════════════════════════════');
    console.log(`  ${out.name} @ ${out.company}`);
    console.log(`  Title:         ${out.title}`);
    console.log(`  Email:         ${out.email||'—'}`);
    console.log(`  Direct Phone:  ${out.directPhone||'—'}`);
    console.log(`  Mobile Phone:  ${out.mobilePhone||'—'}`);
    console.log('══════════════════════════════════════');
  }

  fs.writeFileSync('./techxchange_contacts.json', JSON.stringify(results, null, 2));
  const found = results.filter(r => r.email || r.directPhone || r.mobilePhone).length;
  console.log(`\n✓ Saved to browser-agent/techxchange_contacts.json (${found}/${results.length} with contact data)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
