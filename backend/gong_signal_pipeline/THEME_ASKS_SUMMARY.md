# Customer Ask Groups by Theme — Summary

**What this is:** For each problem theme, customer asks from calls have been grouped into 2–6 deduplicated ask clusters. Use this to answer: *“What are customers actually asking us to build or improve?”* and *“Are multiple customers asking for the same thing in different words?”*

**Source:** 50 customer calls → signals with `customer_ask` → mapped to 6 themes → ask grouping (Step 5).  
**Output file:** `taxonomy/theme_ask_groups.json`

---

## 1. Email Management Inefficiencies  
*10 signals with asks*

| Ask | What customers want | # signals | Confidence |
|-----|---------------------|-----------|------------|
| **Email Automation** | Automate email handling to reduce manual forwarding and improve efficiency | 2 | medium |
| **Email Templates** | Ability to create and use email templates for quicker responses | 1 | medium |
| **Email Tracking and Management** | System to track email responses and ensure no messages are overlooked | 3 | high |
| **Email Categorization** | Platform that categorizes emails by urgency and type for better management | 2 | medium |
| **Integrated Email Management and Collaboration** | Email management combined with team collaboration features | 1 | medium |

*Example phrasing (Email Tracking):* “We need a way to track how we are responding to emails and ensure nothing slips through the cracks.”

---

## 2. Lack of Automation and Integration  
*7 signals with asks*

| Ask | What customers want | # signals | Confidence |
|-----|---------------------|-----------|------------|
| **Automated Email Assignment** | Emails auto-assigned to specific individuals based on content | 2 | high |
| **Integration with Shopify** | Way to integrate with Shopify | 1 | medium |
| **Enhanced Ticket Submission Forms** | Forms with dropdowns and conditional elements for accurate ticket submission | 1 | medium |
| **AI Functionality for Request Prioritization** | AI to automatically prioritize requests | 1 | medium |

*Example phrasing (Auto-assign):* “We want emails addressed to specific individuals to be automatically assigned to them.”

---

## 3. Visibility and Tracking Issues  
*5 signals with asks*

| Ask | What customers want | # signals | Confidence |
|-----|---------------------|-----------|------------|
| **Dashboard for Email Metrics** | Dashboard showing metrics related to email interactions | 1 | high |
| **Timely Email Processing Confirmation** | Mechanism to verify emails are processed promptly | 1 | high |
| **Reporting on Email Interactions and Team Performance** | Tools for reporting and visibility into email interactions and team performance | 1 | high |
| **Visibility on Ticket Ownership and Status** | System that clearly shows ticket ownership and current status | 1 | high |

---

## 4. Cost and Value Concerns  
*5 signals with asks*

| Ask | What customers want | # signals | Confidence |
|-----|---------------------|-----------|------------|
| **Clarification on Pricing and Package Details** | Understand pricing structure and what is included in the package | 2 | high |
| **Evaluation of Contract Options** | Understand benefits of longer contract terms | 1 | medium |
| **Decision Assurance** | Reassurance they are making the right choice with their provider | 1 | medium |

*Example phrasing (Pricing):* “Wants to understand pricing and what is included in the package.”

---

## 5. User Experience and Setup Challenges  
*5 signals with asks*

| Ask | What customers want | # signals | Confidence |
|-----|---------------------|-----------|------------|
| **Ease of Use and Setup** | User-friendly platform with easy workflow setup | 1 | high |
| **Understanding AI Features** | Whether AI features are included in the plan | 1 | high |
| **Accessing Drafts** | Easy way to access and manage drafts | 1 | high |
| **Guidance on Personal Settings** | Assistance navigating and understanding personal settings | 1 | high |

---

## 6. Support and Communication Gaps  
*5 signals with asks*

| Ask | What customers want | # signals | Confidence |
|-----|---------------------|-----------|------------|
| **Integration of Communication Channels** | Integrate various channels (e.g. WhatsApp, phone) into support | 3 | high |
| **Support for Voice Notes** | Capability to use voice notes in support interactions | 1 | medium |
| **Website Query Categorization** | Form on website to categorize queries | 1 | medium |
| **Utilization of Email Capabilities** | Options to switch email services to enhance support | 1 | medium |

*Example phrasing (Channels):* “Looking for options to add WhatsApp to their support system.”

---

## How to use this

- **Roadmap:** Prioritize asks with higher `# signals` and `high` confidence (e.g. Email Tracking, Auto-assign, Integration of Channels).
- **Discovery:** Use example phrasings in interviews; validate which asks are must-have vs nice-to-have.
- **Messaging:** Align positioning with the strongest ask groups (automation, visibility, integration).
- **Gaps:** Asks with no solution today = roadmap gaps; themes with no asks = latent / design opportunity.

**Full detail:** `taxonomy/theme_ask_groups.json` (includes `example_phrasing` arrays per ask group).
