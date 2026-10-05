# Shorthills AI: ICP & Buyer Personas, v0 (hypothesis)

_Prepared 2026-10-05 from ZoomInfo data. Status: **hypothesis, not yet validated by win/loss data.**_

## Read this first: evidence vs. inference

| Source | What it gave us | Label used below |
|---|---|---|
| ZoomInfo GTM context for our org | 3 active offerings: Automotive Data Automation, Customer Support Optimization, Internal Knowledge Portal Transformation (PwC named in the value prop) | **[DATA]** |
| ZoomInfo enrichment | Shorthills AI: GenAI/agent services, ~300 employees, ~$63M revenue, Short Hills NJ. PwC: ~365K employees, $56.9B, accounting/consulting | **[DATA]** |
| ZoomInfo search / lookalike / intent | Account counts, similarity scores, Generative AI intent spikes (Jul–Oct 2026) | **[DATA]** |
| Closed-won vs closed-lost deals | **Not available.** The repo has no customer data, and ZoomInfo has no ICPs, personas or competitors configured | n/a |
| Everything else (tier logic, personas, disqualifiers) | Reasoning from the offerings plus the one named customer | **[INFERENCE]** |

**Caveats:**
- With one named customer (PwC) and no loss data, this ICP can't claim statistical patterns. Treat it as v0 and re-run step 1 once a closed-won/closed-lost export exists (account, domain, outcome, ACV, cycle length, loss reason).
- I made **no assumptions about pricing or ACV**.
- Geographies defaulted to **US + UK** because none were specified.

---

## 1. ICP tier summary

| | **Tier 1: Best fit** | **Tier 2: Strong fit** | **Tier 3: Acceptable** |
|---|---|---|---|
| **Industries** | Accounting, management consulting, law firms | Insurance, banking, automotive (OEMs, parts, dealer groups, auto marketplaces/data) | Same industries as Tier 1 and 2, mid-market |
| **Employees** | 1,000+ | 1,000+ | 250–999 |
| **Revenue** | $250M+ | $500M+ | $50M+ |
| **Geography** | US, UK | US, UK | US, UK |
| **Primary offering** | Internal Knowledge Portal (RAG over cases, opinions, methodologies) | Customer Support Optimization; Automotive Data Automation | Packaged/smaller-scope versions of either |
| **Why this tier** | **[DATA]** Our only named reference (PwC) sits here, and ZoomInfo similarity puts Deloitte, KPMG, EY and Grant Thornton at 0.92–0.96. **[INFERENCE]** Large unstructured knowledge bases plus billable-hour economics give the clearest ROI story. | **[DATA]** 2 of 3 offerings target support- and data-heavy operations, and automotive is named explicitly. **[INFERENCE]** High-volume service desks and dealer/spec data match the pain points. | **[INFERENCE]** Same pains, but smaller budgets, thinner data teams and a higher chance they buy SaaS instead of a custom build |
| **Positive signals** | Generative AI intent score ≥ 75; new CIO/CDO/Chief AI Officer; knowledge-management or innovation team exists | GenAI intent; contact-center expansion; dealer-network growth; recent M&A (data consolidation) | GenAI intent plus a named data/AI owner |
| **Est. addressable accounts, US** | **683** | **1,099** | **4,943** |
| **Est. addressable accounts, UK** | **159** | **195** | **843** |
| **Total** | **842** | **1,294** | **5,786** |

**How the counts were built [DATA]:** ZoomInfo `search_companies` with the filters above and HQ country = US or UK, pulled 2026-10-05.

**Count caveat [INFERENCE]:** ZoomInfo tags companies with several industries, so the counts include noise. For example, UnitedHealth and Live Nation appear under "Management Consulting". Treat each figure as an **upper bound**. A spot-check of the Tier 1 US top 50 suggests roughly 50–60% are true fits, so a realistic Tier 1 range is about 420–500 accounts. Auto marketplaces such as CarGurus and Edmunds are tagged "Media & Internet" and are **not** in the Tier 2 count, so add them by name.

### Disqualifiers

No closed-lost data exists, so **none of these are data-backed**. They are all **[INFERENCE]** and should be confirmed or dropped once loss reasons are available.

1. **IT services firms and systems integrators** (Accenture, Cognizant, Infosys, Capgemini, Genpact, EPAM and others). ZoomInfo returns them as PwC lookalikes, but they build GenAI in-house and compete with us. Treat them as partners or competitors, not targets. They are excluded from the list below.
2. **No data or AI owner.** Without a CDO, Head of AI or knowledge-management lead, a custom agent build has no sponsor.
3. **Under 250 employees or under $50M revenue.** Likely to buy off-the-shelf copilots rather than custom builds.
4. **Data locked in non-digitized sources** (paper, legacy systems with no API). Extends time-to-value past the pilot window.
5. **Mandate to use only a single hyperscaler's native AI stack.** Shrinks the services scope.

---

## 2. Persona cards

Personas are **[INFERENCE]**, derived from each offering's stated pain points **[DATA]**. Validate them against the actual buying committees on closed-won deals.

### Tier 1: Professional services (knowledge portal)

**P1. Chief Innovation / Digital Officer, or Partner leading AI**
- **Responsibilities:** firm-wide AI strategy, innovation budget, client-facing differentiation.
- **Pains:** associates spend hours searching precedents and opinion pieces **[DATA: PwC value prop]**; competitors are marketing "AI-enabled advisory".
- **Goals:** cut research time per engagement, scale expertise without proportional headcount, show partners measurable ROI.
- **Objections:** client confidentiality and data residency; "Copilot already does this"; hallucination risk in advice.
- **Buying triggers:** peer firm announces a GenAI platform; new Chief AI Officer appointed; partner-meeting mandate; GenAI intent spike.

**P2. Director of Knowledge Management / Head of Research Services**
- **Responsibilities:** owns the knowledge base, taxonomy and research librarians.
- **Pains:** fragmented repositories (SharePoint, DMS, Westlaw/Lexis exports); low reuse of past work product.
- **Goals:** a single searchable portal with citations; adoption by fee earners.
- **Objections:** migration effort; fear of being replaced; accuracy of citations.
- **Buying triggers:** DMS migration (iManage/NetDocuments); KM headcount freeze.

**P3. CIO / Head of IT Architecture** _(technical gatekeeper)_
- **Responsibilities:** security, integration, vendor risk.
- **Pains:** shadow-AI usage; pressure to deliver GenAI safely.
- **Goals:** governed, auditable AI on the firm's own tenant.
- **Objections:** vendor viability (Shorthills is ~300 people **[DATA]**); SOC 2/ISO evidence; lock-in.
- **Buying triggers:** AI governance policy approved; cloud landing zone ready.

### Tier 2: Insurance, banking, automotive (support + data automation)

**P4. VP / Director of Customer Experience or Contact Center**
- **Responsibilities:** service-level agreements (SLAs), average handle time (AHT), CSAT, agent productivity.
- **Pains:** agents sift through multiple websites and databases, which delays resolution **[DATA: offering pain point]**.
- **Goals:** lower AHT, higher first-contact resolution, faster agent ramp.
- **Objections:** CCaaS vendor already sells AI add-ons (Genesys, NICE, Salesforce); integration effort; agent adoption.
- **Buying triggers:** CSAT drop; contact-center expansion or outsourcing review; peak-season backlog.

**P5. Head of Data / Chief Data Officer**
- **Responsibilities:** data platform, data quality, AI enablement.
- **Pains:** manual, labor-intensive compilation of specs, reviews and comparisons **[DATA: automotive offering]**; data scattered after M&A.
- **Goals:** automated pipelines feeding products and agents; reusable data assets.
- **Objections:** "we can build this with our team"; cost of a services engagement versus hiring.
- **Buying triggers:** acquisition integration; new product launch needing structured data; data-team attrition.

**P6. VP Dealer Operations / Dealer Network** _(automotive only)_
- **Responsibilities:** dealer onboarding, dealer satisfaction, listing quality.
- **Pains:** a lengthy dealer onboarding process **[DATA: automotive offering]**.
- **Goals:** cut onboarding time, grow active dealers, improve listing completeness.
- **Objections:** dealer-management-system (DMS) integration complexity (CDK, Reynolds); change management with dealers.
- **Buying triggers:** dealer churn; expansion into new regions; new marketplace product.

### Tier 3: Mid-market (any of the above)

**P7. COO or Managing Partner** _(economic buyer and champion in one)_
- **Pains:** same as P1/P4, but with no dedicated AI team.
- **Goals:** a fast, fixed-scope win.
- **Objections:** budget; perceived complexity; "wait for vendors to bundle it".
- **Buying triggers:** a competitor's AI launch; a key-person dependency risk.

**P8. IT Director** _(evaluator)_
- **Pains:** small team stretched thin.
- **Goals:** low-maintenance, managed solution **[DATA: Shorthills offers managed AI governance]**.
- **Objections:** ongoing run cost; security review burden.
- **Buying triggers:** a Microsoft 365 Copilot pilot disappoints; an audit finding on shadow AI.

---

## 3. 25 lookalike target accounts (US/UK)

Similarity = ZoomInfo `find_similar_companies` score versus the reference account. Intent = ZoomInfo Generative AI signal score (60–100) within Jul–Oct 2026.

| # | Account | Tier | ZoomInfo ID | Why (one line) |
|---|---|---|---|---|
| 1 | Deloitte | 1 | 14812699 | Closest PwC lookalike (similarity 0.96); Big Four, same knowledge-portal use case |
| 2 | KPMG | 1 | 380703418 | PwC similarity 0.95; Big Four with large precedent and methodology libraries |
| 3 | EY | 1 | 36900854 | PwC similarity 0.92; Big Four peer, so a PwC reference carries weight |
| 4 | Grant Thornton (US) | 1 | 51711289 | PwC similarity 0.94; US HQ, $5B+ revenue |
| 5 | BDO USA | 1 | 346481142 | PwC similarity 0.72; 10K+ staff, $1–5B accounting firm |
| 6 | RSM US | 1 | 172851843 | Tier 1 US match ($250M+, 1K+ employees); RSM Global similarity 0.74 |
| 7 | Crowe | 1 | 451268369 | PwC similarity 0.63; mid-tier accounting, likely less locked into in-house AI builds |
| 8 | Baker Tilly | 1 | 27759062 | Tier 1 US match; acquisitive accounting firm, so knowledge is fragmented across merged practices |
| 9 | Huron Consulting Group | 1 | 18465332 | PwC similarity 0.61 **and** GenAI intent score 100 (Sep 2026) |
| 10 | Sikich | 1 | 131989777 | Accounting/consulting; GenAI intent score 100 with 4 spikes in range |
| 11 | Weaver | 1 | 91635759 | Accounting firm; GenAI intent score 100 with 4 spikes |
| 12 | McKinsey & Company | 1 | 24232221 | PwC similarity 0.89; very large proprietary knowledge corpus |
| 13 | Oliver Wyman | 1 | 71828105 | PwC similarity 0.73; $1–5B consultancy, 5–10K staff |
| 14 | FTI Consulting | 1 | 15319076 | PwC similarity 0.72; forensic and expert-witness work is research-heavy |
| 15 | Kirkland & Ellis | 1 | 67487955 | Top law firm by revenue in Tier 1 US search; huge case and precedent base |
| 16 | DLA Piper | 1 | 11519296 | UK Tier 1 match; global law firm with cross-jurisdiction knowledge needs |
| 17 | Baker Botts | 1 | 9604492 | Law firm; GenAI intent score 100 with 5 spikes (Sep 2026) |
| 18 | Perkins Coie | 1 | 82936359 | Law firm; GenAI intent score 100 with 3 spikes (Sep 2026) |
| 19 | Cox Automotive | 2 | 10748444 | Closest auto-data lookalike (0.97 vs Cars.com); fits the dealer onboarding and spec-data use case |
| 20 | CarGurus | 2 | 9176186 | Auto marketplace (0.82); car specs, reviews and dealer onboarding are core operations |
| 21 | CDK Global | 2 | 355374833 | Dealer software (0.73); dealer onboarding and support at scale |
| 22 | Hagerty | 2 | 30049924 | Auto-focused insurer, so it spans both the support and automotive-data offerings; GenAI intent 100 |
| 23 | Westfield Insurance | 2 | 297140337 | Insurer with GenAI intent 100; claims and service desks fit Customer Support Optimization |
| 24 | Globe Life | 2 | 96144421 | High-volume life-insurance service operations; GenAI intent 100 (audience strength B) |
| 25 | Edmunds | 3 | 24315366 | Auto marketplace (0.81 vs Cars.com) that compiles specs, reviews and comparisons; 500–1K employees puts it in Tier 3 |

**Deliberately excluded [INFERENCE]:** Accenture, IBM, Cognizant, Capgemini, Infosys, Wipro, HCL, Genpact, EPAM and other IT services firms that appear as PwC lookalikes. They are likely competitors or partners (see Disqualifiers #1).

---

## 4. Next steps to move v0 to v1

1. **Need from you:** a CRM export of closed-won and closed-lost deals from the last 24 months (account, domain, outcome, ACV, sales cycle, loss reason, contact titles on the deal).
2. I'll enrich every account through ZoomInfo and compare won vs. lost on industry, size, revenue, tech stack, growth and buying roles. Then I'll replace the [INFERENCE] tags with measured win rates per segment.
3. Confirm geographies and whether to add Canada, EU or India.
4. Confirm whether Automotive Data Automation is a core segment or a one-off case study. That decides whether automotive stays in Tier 2.
5. Configure the validated ICPs and personas in ZoomInfo GTM settings (needs admin) so future searches are scored against them automatically.
