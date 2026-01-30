# Product Insights from Customer Calls — PM Summary

**What this is:** Problem themes discovered from **102 customer calls** (sales demos, support, and success). Each “signal” is a distinct customer need, pain, or request. Themes represent **problem areas**, not features, and are suitable for discovery, prioritization, and roadmap. (Includes incremental batches classified into the same taxonomy.)

---

## At a glance

| What we analyzed | Count |
|------------------|--------|
| Customer calls | 102 |
| Distinct needs / pains / requests (signals mapped) | 200 |
| Themes (problem areas) | 6 |
| Calls with at least one signal | 73 |

---

## Top 6 problem areas (by how often customers brought them up)

| # | Theme | What it represents | # of mentions |
|---|--------|--------------------|---------------|
| 1 | **Lack of Automation and Integration** | Insufficient automation and integration; manual processes and inefficiencies | 64 |
| 2 | **User Experience and Setup Challenges** | Difficulties with UX and setup; frustration and inefficiencies | 44 |
| 3 | **Visibility and Tracking Issues** | Struggles with visibility and tracking of emails, tasks, and performance | 34 |
| 4 | **Email Management Inefficiencies** | Struggles managing and organizing emails; confusion, delays, missed communications | 23 |
| 5 | **Cost and Value Concerns** | Concerns about cost and whether solutions provide sufficient value | 19 |
| 6 | **Support and Communication Gaps** | Gaps in support and communication; inefficiencies and dissatisfaction | 16 |

---

## What this means for product

**Automation and integration**  
Lack of automation and integration (64) is the top theme. Customers want connectivity, workflow automation, and less manual work. Strong candidate for roadmap and “works with your stack” messaging.

**UX and visibility**  
User experience/setup (44) and visibility/tracking (34) point to operational friction. Prioritize onboarding, setup clarity, and visibility features.

**Email, cost, and support**  
Email management (23), cost/value (19), and support/communication gaps (16) show where discovery and value messaging can help.

---

## How to use this

- **Roadmap:** Use these 6 themes as signal-based input (with other data) for prioritization and sequencing.
- **Discovery:** Deep-dive with CS/Sales on top themes (e.g. automation/integration, UX, visibility) to validate and refine.
- **Messaging and positioning:** Emphasize automation, integration, visibility, and ease of setup in positioning and battlecards.
- **Evidence:** Counts and call-level evidence are in `counts/by_theme.json` and `taxonomy/signal_to_theme.json` for “which calls said what.”
- **Customer asks:** See **THEME_ASKS_SUMMARY.md** for grouped asks per theme.

---

## Where the numbers come from

- **Source:** Gong transcripts (customer calls).
- **Process:** Needs and pains were extracted per call (Step 1), classified into problem themes (Step 3; incremental runs use Step 6 into existing themes). No pre-set taxonomy; themes are derived from the calls.
- **Outputs:**  
  - `counts/summary.json` — totals and top themes.  
  - `counts/by_theme.json` — count and list of calls per theme.  
  - `counts/trends.json` — monthly breakdown.  
  - `taxonomy/global_themes.json` — full list of themes and descriptions.  
  - `taxonomy/theme_ask_groups.json` — grouped customer asks per theme.

A one-pager or slide-ready “top themes + so what” can be derived from this summary.
