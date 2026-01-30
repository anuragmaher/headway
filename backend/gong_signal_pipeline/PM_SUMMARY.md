# Product Insights from Customer Calls — PM Summary

**What this is:** Problem themes discovered from **50 customer calls** (sales demos, support, and success). Each “signal” is a distinct customer need, pain, or request. Themes represent **problem areas**, not features, and are suitable for discovery, prioritization, and roadmap.

---

## At a glance

| What we analyzed | Count |
|------------------|--------|
| Customer calls | 50 |
| Distinct needs / pains / requests (signals mapped) | 37 |
| Themes (problem areas) | 6 |
| Calls with at least one signal | 26 |

---

## Top 6 problem areas (by how often customers brought them up)

| # | Theme | What it represents | # of mentions |
|---|--------|--------------------|---------------|
| 1 | **Email Management Inefficiencies** | Struggles managing and organizing emails; confusion, delays, missed communications | 10 |
| 2 | **Lack of Automation and Integration** | Insufficient automation and integration; manual processes and inefficiencies | 7 |
| 3 | **User Experience and Setup Challenges** | Difficulties with UX and setup; frustration and inefficiencies | 5 |
| 4 | **Cost and Value Concerns** | Concerns about cost and whether solutions provide sufficient value | 5 |
| 5 | **Visibility and Tracking Issues** | Struggles with visibility and tracking of emails, tasks, and performance | 5 |
| 6 | **Support and Communication Gaps** | Gaps in support and communication; inefficiencies and dissatisfaction | 5 |

---

## What this means for product

**Email and workflow**  
Email management inefficiencies are the top theme (10 mentions). Customers want better organization, fewer delays, and fewer missed communications. Strong candidate for roadmap and positioning (e.g. shared inbox, assignment, templates).

**Automation and integration**  
Lack of automation and integration (7) shows demand for connectivity and workflow automation. Good input for integration roadmap and “works with your stack” messaging.

**UX, visibility, and support**  
User experience/setup (5), visibility/tracking (5), and support/communication gaps (5) point to operational friction. Prioritize onboarding, setup clarity, visibility features, and support tooling.

**Cost and value**  
Cost and value concerns (5) show value and pricing matter. Clear value story and pricing clarity help.

---

## How to use this

- **Roadmap:** Use these 6 themes as signal-based input (with other data) for prioritization and sequencing.
- **Discovery:** Deep-dive with CS/Sales on top themes (e.g. email management, automation/integration, visibility) to validate and refine.
- **Messaging and positioning:** Emphasize email workflow, automation, integration, visibility, and ease of setup in positioning and battlecards.
- **Evidence:** Counts and call-level evidence are in `counts/by_theme.json` and `taxonomy/signal_to_theme.json` for “which calls said what.”

---

## Where the numbers come from

- **Source:** Gong transcripts (customer calls).
- **Process:** Needs and pains were extracted per call (Step 1), then classified into problem themes (Step 3) with a 5–15 theme target. No pre-set taxonomy; themes are derived from the calls.
- **Outputs:**  
  - `counts/summary.json` — totals and top themes.  
  - `counts/by_theme.json` — count and list of calls per theme.  
  - `counts/trends.json` — monthly breakdown.  
  - `taxonomy/global_themes.json` — full list of themes and descriptions.

A one-pager or slide-ready “top themes + so what” can be derived from this summary.
