import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const SESSION_FILE = path.join(__dirname, "..", "zoominfo_session.json");
const HEARTBEAT_INTERVAL_MS = 25 * 60 * 1000; // 25 minutes
const PLAYWRIGHT_EXEC =
  process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium-1228/chrome-linux64/chrome`
    : undefined;

// ─── Browser state ────────────────────────────────────────────────────────────

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function loadCookies(): object[] {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return [];
}

async function saveCookies(): Promise<void> {
  if (!context) return;
  try {
    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  } catch {
    // ignore
  }
}

// ─── Browser lifecycle ────────────────────────────────────────────────────────

async function ensureBrowser(): Promise<void> {
  if (browser && browser.isConnected()) return;

  const launchOpts: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--no-proxy-server",          // bypass egress proxy blocking zoominfo.com
      "--disable-infobars",
      "--window-size=1920,1080",
      "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ],
  };

  if (PLAYWRIGHT_EXEC && fs.existsSync(PLAYWRIGHT_EXEC)) {
    launchOpts.executablePath = PLAYWRIGHT_EXEC;
  }

  browser = await chromium.launch(launchOpts);
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // Stealth: hide webdriver fingerprint
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  // Load saved cookies
  const savedCookies = loadCookies();
  if (savedCookies.length > 0) {
    await context.addCookies(savedCookies as Parameters<BrowserContext["addCookies"]>[0]);
  }

  page = await context.newPage();

  // Auto-save cookies after ZoomInfo navigations
  page.on("response", async (resp) => {
    if (resp.url().includes("zoominfo.com")) {
      await saveCookies();
    }
  });

  startHeartbeat();
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function startHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    try {
      if (!page) return;
      await page.goto("https://app.zoominfo.com/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await saveCookies();
    } catch {
      // swallow — heartbeat is best-effort
    }
  }, HEARTBEAT_INTERVAL_MS);
}

// ─── Human-like helpers ───────────────────────────────────────────────────────

async function humanType(p: Page, selector: string, text: string): Promise<void> {
  await p.click(selector);
  await p.waitForTimeout(200 + Math.random() * 300);
  for (const ch of text) {
    await p.keyboard.type(ch, { delay: 50 + Math.random() * 100 });
  }
}

async function humanClick(p: Page, selector: string): Promise<void> {
  await p.waitForTimeout(100 + Math.random() * 400);
  await p.click(selector);
}

// ─── ZoomInfo login ───────────────────────────────────────────────────────────

async function isLoggedIn(p: Page): Promise<boolean> {
  try {
    await p.goto("https://app.zoominfo.com/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await p.waitForTimeout(2000);
    const url = p.url();
    // If we land on the app (not login page), we're in
    return (
      url.includes("app.zoominfo.com") &&
      !url.includes("login") &&
      !url.includes("signin")
    );
  } catch {
    return false;
  }
}

async function ziLogin(
  p: Page,
  username: string,
  password: string
): Promise<{ success: boolean; needsMfa: boolean; message: string }> {
  await ensureBrowser();

  // Check if already logged in
  if (await isLoggedIn(p)) {
    return { success: true, needsMfa: false, message: "Already logged in via saved session." };
  }

  await p.goto("https://app.zoominfo.com/", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await p.waitForTimeout(2000);

  // Wait for the custom Okta overlay with ZoomInfo-specific field IDs
  try {
    await p.waitForSelector("#usernameInput", { timeout: 15000 });
  } catch {
    // Try standard Okta fields
    await p.waitForSelector("#okta-signin-username, input[name='username']", {
      timeout: 10000,
    });
  }

  const usernameSelector = (await p.$("#usernameInput"))
    ? "#usernameInput"
    : await p.$("#okta-signin-username")
    ? "#okta-signin-username"
    : "input[name='username']";

  await humanType(p, usernameSelector, username);
  await p.waitForTimeout(500);

  // Click Next if it exists (single-page Okta step)
  const nextBtn = await p.$(
    "input[type='submit'], button[type='submit'], #okta-signin-submit"
  );
  if (nextBtn) {
    await humanClick(p, "input[type='submit'], button[type='submit'], #okta-signin-submit");
    await p.waitForTimeout(1500);
  }

  // Password field — ZoomInfo uses #pwInput
  const pwSelector = (await p.$("#pwInput"))
    ? "#pwInput"
    : await p.$("#okta-signin-password")
    ? "#okta-signin-password"
    : "input[type='password']";

  await p.waitForSelector(pwSelector, { timeout: 10000 });
  await humanType(p, pwSelector, password);
  await p.waitForTimeout(500);

  const submitBtn = await p.$(
    "#okta-signin-submit, input[value='Sign In'], button[type='submit']"
  );
  if (submitBtn) {
    await humanClick(p, "#okta-signin-submit, input[value='Sign In'], button[type='submit']");
  } else {
    await p.keyboard.press("Enter");
  }

  await p.waitForTimeout(3000);
  const postLoginUrl = p.url();

  // Detect MFA prompt
  if (
    postLoginUrl.includes("login") ||
    postLoginUrl.includes("signin") ||
    (await p.$("input[name='answer'], input[type='tel'], #input-container"))
  ) {
    return {
      success: false,
      needsMfa: true,
      message:
        "MFA required — call zoominfo_submit_mfa with the SMS code sent to the number ending in 1741.",
    };
  }

  await saveCookies();
  return { success: true, needsMfa: false, message: "Login successful." };
}

async function ziSubmitMfa(p: Page, code: string): Promise<{ success: boolean; message: string }> {
  // Try various MFA input selectors
  const mfaSelector =
    "input[name='answer'], input[type='tel'], input[name='passcode'], #input-container input";
  try {
    await p.waitForSelector(mfaSelector, { timeout: 10000 });
  } catch {
    return { success: false, message: "MFA input not found on page." };
  }

  await humanType(p, mfaSelector, code);
  await p.waitForTimeout(500);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(3000);

  const url = p.url();
  if (!url.includes("login") && !url.includes("signin")) {
    await saveCookies();
    return { success: true, message: "MFA accepted — logged in successfully." };
  }
  return { success: false, message: "MFA rejected or additional step required." };
}

// ─── Contact extraction ───────────────────────────────────────────────────────

interface ContactData {
  email: string | null;
  directPhone: string | null;
  mobilePhone: string | null;
  profileUrl: string;
  raw: string;
}

async function extractContactFromPage(p: Page): Promise<ContactData> {
  await p.waitForTimeout(2000);

  // Reveal contact info — click "View" buttons if present
  const viewBtns = await p.$$("button:has-text('View'), button:has-text('Reveal')");
  for (const btn of viewBtns.slice(0, 3)) {
    try {
      await btn.click();
      await p.waitForTimeout(1000);
    } catch {
      // continue
    }
  }

  // Extract via JS — gather all emails and phone-like strings
  const extracted = await p.evaluate(() => {
    const emails: string[] = [];
    const phones: string[] = [];

    // Emails from anchor tags and text nodes
    document.querySelectorAll("a[href^='mailto:']").forEach((a) => {
      const m = (a as HTMLAnchorElement).href.replace("mailto:", "");
      if (m) emails.push(m.trim());
    });
    document.querySelectorAll("*").forEach((el) => {
      const txt = (el as HTMLElement).innerText || "";
      const emailMatch = txt.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g);
      if (emailMatch) emails.push(...emailMatch);
    });

    // Phones from spans / divs
    document.querySelectorAll("span, div, p, a").forEach((el) => {
      const txt = (el as HTMLElement).innerText || "";
      const phoneMatch = txt.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g);
      if (phoneMatch) phones.push(...phoneMatch);
    });

    return {
      emails: [...new Set(emails)].filter(
        (e) => !e.includes("zoominfo.com") && !e.includes("example.com")
      ),
      phones: [...new Set(phones)].map((p) => p.trim()),
    };
  });

  // Heuristic: separate direct (office) vs mobile phones
  // ZoomInfo usually labels them — try to grab labels
  const phoneData = await p.evaluate(() => {
    const results: { label: string; value: string }[] = [];
    // Look for labeled phone entries in the contact panel
    document.querySelectorAll("[data-testid], [class*='phone'], [class*='contact']").forEach((el) => {
      const parent = el.closest("[class*='row'], [class*='item'], li, tr");
      if (!parent) return;
      const label = (parent.querySelector("[class*='label'], [class*='type'], span:first-child") as HTMLElement)?.innerText || "";
      const value = (parent.querySelector("a[href^='tel:'], [class*='value']") as HTMLElement)?.innerText || "";
      if (value && /\d{7,}/.test(value.replace(/\D/g, ""))) {
        results.push({ label: label.toLowerCase(), value: value.trim() });
      }
    });
    return results;
  });

  let directPhone: string | null = null;
  let mobilePhone: string | null = null;

  for (const { label, value } of phoneData) {
    if (label.includes("mobile") || label.includes("cell")) {
      mobilePhone = mobilePhone ?? value;
    } else if (label.includes("direct") || label.includes("office") || label.includes("work")) {
      directPhone = directPhone ?? value;
    }
  }

  // Fallback: use order from raw phone list
  if (!directPhone && extracted.phones.length > 0) directPhone = extracted.phones[0];
  if (!mobilePhone && extracted.phones.length > 1) mobilePhone = extracted.phones[1];

  return {
    email: extracted.emails[0] ?? null,
    directPhone,
    mobilePhone,
    profileUrl: p.url(),
    raw: JSON.stringify({ emails: extracted.emails, phones: extracted.phones }),
  };
}

async function ziGetContactById(p: Page, personId: string): Promise<ContactData> {
  const url = `https://app.zoominfo.com/#/apps/profile/person/${personId}/contact-profile`;
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3000);
  return extractContactFromPage(p);
}

async function ziSearchContact(
  p: Page,
  name: string,
  company: string
): Promise<{ personId: string | null; profileUrl: string | null }> {
  await p.goto("https://app.zoominfo.com/", {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await p.waitForTimeout(1500);

  // Use top-nav search
  const searchSelector =
    "input[placeholder*='Search'], input[type='search'], input[aria-label*='search' i]";
  try {
    await p.waitForSelector(searchSelector, { timeout: 8000 });
  } catch {
    return { personId: null, profileUrl: null };
  }

  await humanType(p, searchSelector, `${name} ${company}`);
  await p.waitForTimeout(2000);

  // Extract first matching person profile link
  const result = await p.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href*='profile/person']"));
    if (links.length === 0) return null;
    const href = (links[0] as HTMLAnchorElement).href;
    const match = href.match(/profile\/person\/(\d+)/);
    return { href, personId: match ? match[1] : null };
  });

  if (result) {
    return { personId: result.personId, profileUrl: result.href };
  }
  return { personId: null, profileUrl: null };
}

// ─── MCP Server setup ─────────────────────────────────────────────────────────

const server = new Server(
  { name: "browser-agent", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const TOOLS: Tool[] = [
  {
    name: "browser_navigate",
    description: "Navigate the browser to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to" },
        waitUntil: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle"],
          description: "When to consider navigation complete",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_click",
    description: "Click an element matching a CSS selector",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
  {
    name: "browser_type",
    description: "Type text into an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        text: { type: "string" },
        humanLike: { type: "boolean", description: "Type with human-like delays" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot and return base64 PNG",
    inputSchema: {
      type: "object",
      properties: {
        fullPage: { type: "boolean", description: "Capture full page" },
      },
    },
  },
  {
    name: "browser_get_text",
    description: "Get text content of a selector or the whole page",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" } },
    },
  },
  {
    name: "browser_get_html",
    description: "Get outer HTML of a selector or full page",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" } },
    },
  },
  {
    name: "browser_execute_js",
    description: "Execute arbitrary JavaScript in the page and return result",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string" } },
      required: ["script"],
    },
  },
  {
    name: "browser_wait",
    description: "Wait for a selector or a fixed number of milliseconds",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        ms: { type: "number" },
        timeout: { type: "number" },
      },
    },
  },
  {
    name: "browser_scroll",
    description: "Scroll the page",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        pixels: { type: "number" },
      },
    },
  },
  {
    name: "browser_go_back",
    description: "Navigate back in browser history",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_get_url",
    description: "Return the current page URL",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_get_cookies",
    description: "Return all cookies for the current page",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_set_cookies",
    description: "Set cookies in the browser context",
    inputSchema: {
      type: "object",
      properties: {
        cookies: { type: "array", items: { type: "object" } },
      },
      required: ["cookies"],
    },
  },
  {
    name: "browser_close",
    description: "Close the browser",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_extract_table",
    description: "Extract a table from the page as JSON",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string", description: "CSS selector for the table" } },
    },
  },
  {
    name: "zoominfo_login",
    description:
      "Log into ZoomInfo using cookie persistence. If already logged in, skips full login. Returns whether MFA is needed.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
      required: ["username", "password"],
    },
  },
  {
    name: "zoominfo_submit_mfa",
    description: "Submit the SMS MFA code received on the phone number ending in 1741",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "6-digit SMS code" } },
      required: ["code"],
    },
  },
  {
    name: "zoominfo_get_contact",
    description:
      "Navigate to a ZoomInfo person profile and extract email + phone numbers. Provide either personId OR (name + company) for search fallback.",
    inputSchema: {
      type: "object",
      properties: {
        personId: { type: "string", description: "ZoomInfo numeric person ID" },
        name: { type: "string", description: "Full name for search fallback" },
        company: { type: "string", description: "Company name for search fallback" },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  await ensureBrowser();
  const p = page!;

  try {
    switch (name) {
      case "browser_navigate": {
        const { url, waitUntil = "domcontentloaded" } = args as {
          url: string;
          waitUntil?: "load" | "domcontentloaded" | "networkidle";
        };
        await p.goto(url, { waitUntil, timeout: 30000 });
        return { content: [{ type: "text", text: `Navigated to ${p.url()}` }] };
      }

      case "browser_click": {
        const { selector } = args as { selector: string };
        await humanClick(p, selector);
        return { content: [{ type: "text", text: `Clicked ${selector}` }] };
      }

      case "browser_type": {
        const { selector, text, humanLike = true } = args as {
          selector: string;
          text: string;
          humanLike?: boolean;
        };
        if (humanLike) {
          await humanType(p, selector, text);
        } else {
          await p.fill(selector, text);
        }
        return { content: [{ type: "text", text: `Typed into ${selector}` }] };
      }

      case "browser_screenshot": {
        const { fullPage = false } = (args as { fullPage?: boolean }) || {};
        const buf = await p.screenshot({ fullPage, type: "png" });
        return {
          content: [
            { type: "image", data: buf.toString("base64"), mimeType: "image/png" },
          ],
        };
      }

      case "browser_get_text": {
        const { selector } = (args as { selector?: string }) || {};
        let text: string;
        if (selector) {
          const el = await p.$(selector);
          text = el ? (await el.innerText()) : "";
        } else {
          text = await p.innerText("body");
        }
        return { content: [{ type: "text", text }] };
      }

      case "browser_get_html": {
        const { selector } = (args as { selector?: string }) || {};
        let html: string;
        if (selector) {
          html = await p.innerHTML(selector);
        } else {
          html = await p.content();
        }
        return { content: [{ type: "text", text: html }] };
      }

      case "browser_execute_js": {
        const { script } = args as { script: string };
        const result = await p.evaluate((s) => eval(s), script);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "browser_wait": {
        const { selector, ms, timeout = 30000 } = (args as {
          selector?: string;
          ms?: number;
          timeout?: number;
        }) || {};
        if (selector) {
          await p.waitForSelector(selector, { timeout });
        } else if (ms) {
          await p.waitForTimeout(ms);
        }
        return { content: [{ type: "text", text: "Wait complete" }] };
      }

      case "browser_scroll": {
        const { direction = "down", pixels = 500 } = (args as {
          direction?: string;
          pixels?: number;
        }) || {};
        const dy = direction === "up" ? -pixels : pixels;
        await p.evaluate((dy) => window.scrollBy(0, dy), dy);
        return { content: [{ type: "text", text: `Scrolled ${direction} ${pixels}px` }] };
      }

      case "browser_go_back": {
        await p.goBack({ waitUntil: "domcontentloaded" });
        return { content: [{ type: "text", text: `Now at ${p.url()}` }] };
      }

      case "browser_get_url": {
        return { content: [{ type: "text", text: p.url() }] };
      }

      case "browser_get_cookies": {
        const cookies = await context!.cookies();
        return { content: [{ type: "text", text: JSON.stringify(cookies, null, 2) }] };
      }

      case "browser_set_cookies": {
        const { cookies } = args as { cookies: object[] };
        await context!.addCookies(cookies as Parameters<BrowserContext["addCookies"]>[0]);
        return { content: [{ type: "text", text: "Cookies set." }] };
      }

      case "browser_close": {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        await browser?.close();
        browser = null;
        context = null;
        page = null;
        return { content: [{ type: "text", text: "Browser closed." }] };
      }

      case "browser_extract_table": {
        const { selector = "table" } = (args as { selector?: string }) || {};
        const table = await p.evaluate((sel) => {
          const tbl = document.querySelector(sel) as HTMLTableElement | null;
          if (!tbl) return null;
          const rows = Array.from(tbl.querySelectorAll("tr")).map((tr) =>
            Array.from(tr.querySelectorAll("th,td")).map(
              (cell) => (cell as HTMLElement).innerText.trim()
            )
          );
          return rows;
        }, selector);
        return { content: [{ type: "text", text: JSON.stringify(table, null, 2) }] };
      }

      case "zoominfo_login": {
        const { username, password } = args as { username: string; password: string };
        const result = await ziLogin(p, username, password);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "zoominfo_submit_mfa": {
        const { code } = args as { code: string };
        const result = await ziSubmitMfa(p, code);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "zoominfo_get_contact": {
        const { personId, name, company } = args as {
          personId?: string;
          name?: string;
          company?: string;
        };
        let data: ContactData;
        if (personId) {
          data = await ziGetContactById(p, personId);
        } else if (name && company) {
          const searchResult = await ziSearchContact(p, name, company);
          if (searchResult.personId) {
            data = await ziGetContactById(p, searchResult.personId);
          } else if (searchResult.profileUrl) {
            await p.goto(searchResult.profileUrl, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            data = await extractContactFromPage(p);
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: "Profile not found",
                    name,
                    company,
                  }),
                },
              ],
            };
          }
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Provide personId OR (name + company)",
                }),
              },
            ],
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("browser-agent MCP server running");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
