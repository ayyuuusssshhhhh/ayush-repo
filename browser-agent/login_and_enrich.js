const { chromium } = require('playwright');
const fs = require('fs');
const CHROMIUM_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SESSION_FILE = './zoominfo_session.json';
const delay = ms => new Promise(r => setTimeout(r, ms));

const CREDS = { username: 'ayush.grack@shorthills.ai', password: 'Sales@12345' };
const MFA_CODE = process.env.MFA_CODE || '952382';

// Person IDs to enrich — extend as needed
const CONTACTS = [
  { personId: '1289846420', name: 'John Tarantino', company: 'Arbor Realty Trust' },
];

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

  // Load saved cookies if any
  const saved = fs.existsSync(SESSION_FILE) ? JSON.parse(fs.readFileSync(SESSION_FILE,'utf8')) : [];
  if (saved.length) { await ctx.addCookies(saved); console.log(`Loaded ${saved.length} cookies`); }

  const page = await ctx.newPage();
  await page.goto('https://app.zoominfo.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(3000);
  console.log('Initial URL:', page.url());

  // ── Login if needed ──────────────────────────────────────────────────────
  if (page.url().includes('login') || page.url().includes('signin')) {
    // Dismiss cookie banner
    const cookieBtn = await page.$('button#onetrust-accept-btn-handler');
    if (cookieBtn) { await cookieBtn.click(); await delay(800); }

    await page.waitForSelector('#usernameInput', { state: 'visible', timeout: 15000 });
    await page.fill('#usernameInput', CREDS.username);
    await delay(300);
    await page.fill('#pwInput', CREDS.password);
    await delay(300);

    // Click the visible "Log In" button
    const btns = await page.$$('button');
    let clicked = false;
    for (const b of btns) {
      const t = (await b.innerText().catch(() => '')).trim().toLowerCase();
      const vis = await b.isVisible().catch(() => false);
      if (vis && (t === 'log in' || t === 'sign in')) {
        await b.click(); clicked = true;
        console.log(`Clicked "${t}"`);
        break;
      }
    }
    if (!clicked) { await page.focus('#pwInput'); await page.keyboard.press('Enter'); }
    await delay(4000);

    // ── MFA: Email Authentication ─────────────────────────────────────────
    const mfaVisible = await page.$('input[name="answer"], input[placeholder*="code" i], input[type="tel"]');
    const emailAuthText = (await page.innerText('body').catch(() => '')).toLowerCase();
    if (mfaVisible || emailAuthText.includes('email authentication') || emailAuthText.includes('enter code')) {
      console.log('MFA prompt detected — entering code:', MFA_CODE);
      // Fill whichever input is visible
      const mfaInput = await page.$('input[name="answer"]')
        || await page.$('input[placeholder*="code" i]')
        || await page.$('input[type="tel"]')
        || await page.$('input[aria-label*="code" i]')
        || (await page.$$('input[type="text"]')).find(async el => (await el.isVisible()));

      // Fallback: find by position on page
      const allInputs = await page.$$('input[type="text"], input[type="number"], input[type="tel"]');
      for (const inp of allInputs) {
        if (await inp.isVisible()) {
          await inp.fill(MFA_CODE);
          console.log('Filled MFA code');
          break;
        }
      }

      await delay(400);

      // Click Verify via JS to bypass intercepting overlay divs
      const verifyClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => /verify|submit|confirm/i.test(b.innerText.trim()));
        if (btn) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
        return false;
      });
      console.log('Verify button JS click:', verifyClicked);
      if (!verifyClicked) await page.keyboard.press('Enter');
      await delay(6000);
    }

    console.log('Post-auth URL:', page.url());
    await page.screenshot({ path: './debug_postauth.png' });
  }

  // Save cookies
  const cookies = await ctx.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log(`Saved ${cookies.length} cookies`);

  const currentUrl = page.url();
  if (currentUrl.includes('login') || currentUrl.includes('signin')) {
    console.log('ERROR: Still on login page. Login failed.');
    const txt = (await page.innerText('body').catch(() => '')).slice(0, 800);
    console.log('Page:', txt);
    await browser.close();
    process.exit(1);
  }

  console.log('\n✓ Logged in! Current URL:', currentUrl);

  // ── Extract each contact ─────────────────────────────────────────────────
  for (const contact of CONTACTS) {
    console.log(`\nEnriching: ${contact.name} (personId: ${contact.personId})`);
    const profileUrl = `https://app.zoominfo.com/#/apps/profile/person/${contact.personId}/contact-profile`;
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(6000);
    await page.screenshot({ path: `./${contact.personId}_before.png` });

    // Click all View/Reveal buttons
    for (let pass = 0; pass < 5; pass++) {
      const btns = await page.$$('button, [role="button"]');
      let clicked = 0;
      for (const b of btns) {
        const t = (await b.innerText().catch(() => '')).trim().toLowerCase();
        const vis = await b.isVisible().catch(() => false);
        if (vis && (t === 'view' || t === 'reveal' || t.startsWith('view ') || t.includes('show email') || t.includes('show phone'))) {
          console.log(`  Clicking: "${t}"`);
          await b.click().catch(() => {});
          clicked++;
          await delay(2000);
        }
      }
      if (clicked === 0) break;
      await delay(1000);
    }

    await page.screenshot({ path: `./${contact.personId}_after.png` });

    // Extract
    const result = await page.evaluate(() => {
      const emails = new Set();
      const phones = [];
      const seenPhones = new Set();

      document.querySelectorAll('a[href^="mailto:"]').forEach(a =>
        emails.add(a.href.replace('mailto:','').split('?')[0].trim())
      );
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length > 0) return;
        const t = (el.innerText || '').trim();
        (t.match(/[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g)||[]).forEach(e => emails.add(e));
      });

      document.querySelectorAll('a[href^="tel:"]').forEach(a => {
        const digits = a.href.replace(/\D/g,'');
        if (digits.length >= 10 && !seenPhones.has(digits)) {
          seenPhones.add(digits);
          const parent = a.closest('li,tr,[class*="row"],[class*="item"],div');
          const label = parent
            ? ([...parent.querySelectorAll('span,label,[class*="label"],[class*="type"]')]
                .map(el => el.innerText).find(t => t && t.length < 30) || 'unknown')
            : 'unknown';
          phones.push({ label: label.toLowerCase().trim(), value: a.innerText.trim() || a.href.replace('tel:','') });
        }
      });

      // Fallback text scan
      document.querySelectorAll('span,div,p,li').forEach(el => {
        const t = (el.innerText||'').trim();
        (t.match(/(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g)||[]).forEach(ph => {
          const digits = ph.replace(/\D/g,'');
          if (digits.length >= 10 && !seenPhones.has(digits)) {
            seenPhones.add(digits);
            phones.push({ label: 'unknown', value: ph.trim() });
          }
        });
      });

      return {
        emails: [...emails].filter(e => !e.includes('zoominfo.com') && !e.includes('example.com') && e.includes('@')),
        phones
      };
    });

    // Classify phones
    let direct = null, mobile = null;
    for (const { label, value } of result.phones) {
      if (label.includes('mobile')||label.includes('cell')) mobile = mobile||value;
      else if (label.includes('direct')||label.includes('office')||label.includes('work')) direct = direct||value;
      else if (!direct) direct = value;
      else if (!mobile) mobile = value;
    }

    const out = {
      ...contact,
      email: result.emails[0] || null,
      directPhone: direct,
      mobilePhone: mobile,
      allEmails: result.emails,
      allPhones: result.phones,
    };

    console.log('\n══════════════════════════════════════════');
    console.log(`  ${out.name} @ ${out.company}`);
    console.log(`  Email:         ${out.email || '—'}`);
    console.log(`  Direct Phone:  ${out.directPhone || '—'}`);
    console.log(`  Mobile Phone:  ${out.mobilePhone || '—'}`);
    console.log('══════════════════════════════════════════');

    fs.writeFileSync('./enrichment_result.json', JSON.stringify(out, null, 2));
  }

  await browser.close();
  console.log('\n✓ Done. Results in browser-agent/enrichment_result.json');
})().catch(e => { console.error(e); process.exit(1); });
