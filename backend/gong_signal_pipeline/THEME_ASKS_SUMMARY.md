# Customer Ask Groups by Theme — Exhaustive Summary

**What this is:** For each problem theme, customer asks from **102 calls** are grouped into deduplicated ask clusters. Counts include incremental batches (Step 6). Use this to answer: *“What are customers actually asking us to build or improve?”* and *“Are multiple customers asking for the same thing in different words?”*

**Source:** 102 customer calls → signals with `customer_ask` → mapped to 6 themes → ask grouping (Step 5) + incremental classification (Step 6).  
**Data:** `taxonomy/theme_ask_groups.json` | **Proposals:** `taxonomy/proposed_new_asks.json`

---

## 1. Email Management Inefficiencies  
*Theme total: 23 signals mapped | 10 signals with customer_ask in ask groups*

| # | Ask name | What customers want | Signals | Confidence | Example phrasings |
|---|----------|---------------------|---------|------------|-------------------|
| 1 | **Email Automation** | Automate email handling to reduce manual forwarding and improve efficiency | 2 | medium | “I would need to automate that because now I'm responsible for the support in terms that I'll forward the message to someone in our team.” |
| 2 | **Email Templates** | Ability to create and use email templates for quicker responses | 1 | medium | “It would be good if I could create templates and just send them.” |
| 3 | **Email Tracking and Management** | System to track email responses and ensure no emails are overlooked | 7 | high | “We need a way to track how we are responding to emails and ensure nothing slips through the cracks.” / “Looking for solutions to prevent things from getting dropped and missed.” |
| 4 | **Email Categorization** | Platform that categorizes emails by urgency and type for better management | 7 | high | “They need a platform that can categorize emails based on urgency and type.” / “We need a system that categorizes where everything is at in the process.” |
| 5 | **Integrated Email Management and Collaboration** | Email management combined with team collaboration features | 7 | medium | “Looking for a solution that integrates email management and collaboration.” |

---

## 2. Lack of Automation and Integration  
*Theme total: 64 signals mapped | 7 signals with customer_ask in ask groups (counts below reflect incremental adds)*

| # | Ask name | What customers want | Signals | Confidence | Example phrasings |
|---|----------|---------------------|---------|------------|-------------------|
| 1 | **Automated Email Assignment** | Emails auto-assigned to specific individuals based on content | 20 | high | “We want emails addressed to specific individuals to be automatically assigned to them.” / “Wants to know if there's a way to auto-assign emails based on their content.” |
| 2 | **Integration with Shopify** | Way to integrate with Shopify | 5 | medium | “The customer expressed a desire to set up a Shopify integration.” |
| 3 | **Enhanced Ticket Submission Forms** | Forms with dropdowns and conditional elements for accurate ticket submission | 1 | medium | “Need a form that includes dropdowns and conditional elements to ensure correct ticket submission.” |
| 4 | **AI for Request Prioritization** | AI to automatically prioritize requests | 1 | medium | “Interested in AI functionality to prioritize requests automatically.” |

---

## 3. Visibility and Tracking Issues  
*Theme total: 34 signals mapped*

| # | Ask name | What customers want | Signals | Confidence | Example phrasings |
|---|----------|---------------------|---------|------------|-------------------|
| 1 | **Dashboard for Email Metrics** | Dashboard showing metrics related to email interactions | 1 | high | “They want a dashboard that shows the count of different types of emails received.” |
| 2 | **Timely Email Processing Confirmation** | Mechanism to verify emails are processed promptly | 1 | high | “We need a way to have a double check that the emails are getting processed in a timely manner.” |
| 3 | **Reporting on Email Interactions and Team Performance** | Tools for reporting and visibility into email interactions and team performance | 10 | high | “Tools that provide reporting and visibility into email interactions and team performance.” |
| 4 | **Visibility on Ticket Ownership and Status** | System that clearly shows who owns tickets and current status | 7 | high | “A system that provides visibility on ticket ownership and status.” |

---

## 4. Cost and Value Concerns  
*Theme total: 19 signals mapped*

| # | Ask name | What customers want | Signals | Confidence | Example phrasings |
|---|----------|---------------------|---------|------------|-------------------|
| 1 | **Clarification on pricing and package details** | Understand pricing structure and what is included in the package | 13 | high | “Wants to understand pricing and what is included in the package.” / “Wants to discuss the best case scenario on pricing.” |
| 2 | **Evaluation of contract options** | Understand benefits of longer contract terms | 1 | medium | “What advantages can you offer for a two or three-year contract?” |
| 3 | **Decision-making assurance** | Reassurance they are making the right choice in their service provider | 1 | medium | “I want to make sure that I'm making the right decision.” |

---

## 5. User Experience and Setup Challenges  
*Theme total: 44 signals mapped*

| # | Ask name | What customers want | Signals | Confidence | Example phrasings |
|---|----------|---------------------|---------|------------|-------------------|
| 1 | **Ease of Use and Workflow Setup** | User-friendly platform with easy workflow setup | 12 | high | “Looking for a platform that is easy to use and set up workflows.” |
| 2 | **Clarification on AI Features** | Whether AI features are included in the subscription plan | 10 | high | “Wants to know if AI features are included in the plan.” |
| 3 | **Access to Drafts** | Ability to access and manage drafts in a dedicated location | 1 | high | “Is there like a separate folder that I can just, he can just check all my drafts?” |
| 4 | **Guidance on Personal Settings** | Assistance navigating and understanding personal settings | 5 | high | “Can you take us through the personal settings?” |

---

## 6. Support and Communication Gaps  
*Theme total: 16 signals mapped*

| # | Ask name | What customers want | Signals | Confidence | Example phrasings |
|---|----------|---------------------|---------|------------|-------------------|
| 1 | **Integration of Communication Channels** | Integrate various channels (e.g. WhatsApp, phone) into support | 5 | high | “Looking for options to add WhatsApp to their support system.” / “The customer is interested in a platform that integrates phone support natively.” |
| 2 | **Support for Voice Notes** | Capability to use voice notes in support interactions | 1 | medium | “They want to know if voice notes can be supported.” |
| 3 | **Website Query Categorization** | Form on website to categorize queries | 1 | medium | “Is it possible to set up a form on our website to categorize queries?” |
| 4 | **Utilization of Email Capabilities** | Options to switch email services to enhance support | 7 | medium | “Exploring the possibility of switching to Google emails to utilize Hiver's full capabilities.” |

---

## Proposed new asks (not yet in taxonomy)

These were suggested by the incremental classifier (Step 6) when new asks did not match existing groups. Review and add to taxonomy if approved.

| Theme | Proposed ask name | Description | Signals | Confidence |
|-------|--------------------|-------------|--------|------------|
| Visibility and Tracking Issues | **Email Tracking Clarification** | Clarification on how to track emails sent from specific addresses | 1 | medium |
| Visibility and Tracking Issues | **Owner Message Tracking** | Way to track owner messages that haven't been responded to in a specific timeframe | 1 | medium |
| Visibility and Tracking Issues | **Pending Item Visibility** | Better way to see pending items on dashboard | 1 | low |
| Visibility and Tracking Issues | **Email Delegation System** | System that allows appropriate delegation of emails | 1 | low |
| Visibility and Tracking Issues | **Transparency Management** | Better solution to manage transparency and visibility on tickets and emails | 1 | medium |
| Support and Communication Gaps | **Improved Documentation Practices** | Solution that encourages better documentation practices among sales staff | 1 | medium |
| Support and Communication Gaps | **Email Response Management** | Tool that can flag emails where support did not reply or did not reply appropriately | 1 | medium |

*Full detail: `taxonomy/proposed_new_asks.json`*

---

## How to use this

- **Roadmap:** Prioritize ask groups with higher **Signals** and **high** confidence (e.g. Automated Email Assignment 20, Clarification on pricing 13, Ease of Use 12, Reporting 10, Clarification on AI 10).
- **Discovery:** Use example phrasings in interviews; validate must-have vs nice-to-have.
- **Messaging:** Align positioning with strongest ask groups (automation, visibility, integration, ease of setup).
- **Proposals:** Add proposed new asks to taxonomy and theme_ask_groups if approved; then re-run Step 5 or merge manually.

**Full data:** `taxonomy/theme_ask_groups.json` (all example_phrasing arrays per ask group).
