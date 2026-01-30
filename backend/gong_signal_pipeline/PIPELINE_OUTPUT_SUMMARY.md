# Gong Signal Discovery Pipeline — Output Summary

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Signals mapped** | 292 |
| **Transcripts with signals** | 74 |
| **Total themes** | 49 |
| **Total sub-themes** | 50 |
| **Time bucket** | month |

---

## 2. Top themes by signal count

| Rank | Theme name | Count | Type |
|------|------------|-------|------|
| 1 | **AI Features** | 49 | Existing |
| 2 | **Knowledge Base** | 38 | Existing |
| 3 | **Email Filtering Solutions** | 19 | Proposed |
| 4 | **Customer Journey Management** | 18 | Proposed |
| 5 | **Email Management Challenges** | 15 | Proposed |
| 6 | **IT Support Process Improvement** | 9 | Proposed |
| 7 | **Shared Inbox Management** (multi-inbox) | 9 | Proposed |
| 8 | **Unified Communication** | 6 | Proposed |
| 9 | **Workflow Visibility** | 6 | Proposed |
| 10 | **Email Security** | 6 | Proposed |

---

## 3. Top sub-themes by signal count

| Rank | Sub-theme name | Theme | Count |
|------|----------------|-------|-------|
| 1 | **Internal Knowledge Base** | Knowledge Base | 38 |
| 2 | **AI Agent** | AI Features | 38 |
| 3 | **Email Filtering** (filter/prioritize high-volume inboxes) | Email Filtering Solutions | 19 |
| 4 | **Customer Journey / Support Interactions** | Customer Journey Management | 18 |
| 5 | **Email Management** (multiple inboxes, inefficiencies) | Email Management Challenges | 15 |
| 6 | **AI Knowledge** | AI Features | 11 |
| 7 | **IT Support / Ticket Prioritization** | IT Support Process Improvement | 9 |
| 8 | **Multiple Shared Inbox Coordination** | Shared Inbox Management | 9 |
| 9 | **Unified Communication** (integrated channels) | Unified Communication | 6 |
| 10 | **Workflow Visibility** (accountability, communication) | Workflow Visibility | 6 |

---

## 4. Global taxonomy (structure)

### 4.1 Existing themes (from themes.json)

| Theme | Sub-themes |
|-------|-------------|
| **AI Features** | AI Copilot, AI Agent, AI Knowledge, AI Quality |
| **Knowledge Base** | Help Center, Internal Knowledge Base |

### 4.2 Proposed themes (from pipeline)

Pipeline-discovered themes marked **proposed** (for PM review before adding to canonical taxonomy):

- Pricing Concerns  
- Cost Justification  
- Unified Communication  
- 24/7 Support Solutions  
- SLA Monitoring  
- Free Tier Limitations  
- Compliance Requirements  
- Chat Feature Concerns  
- Budget Management  
- IT Support Process Improvement  
- Shared Inbox Management  
- Non-Traditional Support Systems  
- Email Management Solutions  
- Workflow Visibility  
- Out-of-Office Management  
- Integration Complexity  
- Email Management Challenges  
- Email Filtering Solutions  
- Customer Journey Management  
- AI Cost Concerns  
- AI Training Time  
- Knowledge Management Challenges  
- Technical Issue Tracking  
- Email Functionality Issues  
- Performance Analytics Gaps  
- Trouble Tracking Systems  
- Automatic Reply Setup  
- Tech Stack Alignment  
- WhatsApp Integration Challenges  
- Email Template Management  
- Email Deletion Concerns  
- Inquiry Categorization Solutions  
- Public Email Management  
- Shared Inbox Management (secure access)  
- Email Organization  
- Product Utilization (Hiver Best Practices)  
- Email Security  
- Shared Inbox Management (multi-inbox)  
- Onboarding and Training  
- Communication Management  
- Form Management  
- Task Management  
- Client Relationship Management  
- Performance Tracking  
- Plan Limitations  
- Integration Management  
- Software Complexity  

---

## 5. Evidence (by theme)

**AI Features** (49 signals) — sample transcript IDs:  
`01_2363083900669717369`, `01_5759700453900699854`, `02_1779613692961633968`, `03_4349435023058882263`, … (28 transcripts total).

**Knowledge Base** (38 signals) — sample transcript IDs:  
`01_2363083900669717369`, `02_1779613692961633968`, `03_4349435023058882263`, … (24 transcripts total).

Full evidence lists (transcript_id per theme/sub-theme) are in:  
`gong_signal_pipeline/counts/by_theme.json`.

---

## 6. Trends (monthly)

Signals are bucketed by transcript date (`started`). Example buckets:

| Period | Themes with signals | Notes |
|--------|---------------------|--------|
| **2025-11** | 49 themes | Most signals in this month |
| **2025-12** | (see trends.json) | Later transcripts |

Top themes in **2025-11**: AI Features (46), Knowledge Base (25), Email Filtering Solutions (19), Email Management Challenges (15), Customer Journey Management (18).

Full time series: `gong_signal_pipeline/counts/trends.json` (by_theme and by_sub_theme per month).

---

## 7. Output files reference

| Path | Description |
|------|-------------|
| `signals/all_signals.json` | All extracted signals per transcript |
| `signals/manifest.json` | Step 1 manifest (transcripts processed, total signals) |
| `local_themes/batch_*.json` | Local clusters per batch |
| `taxonomy/global_themes.json` | Full theme/sub-theme taxonomy (existing + proposed) |
| `taxonomy/signal_to_theme.json` | Signal ID → theme_id, sub_theme_id, transcript_id |
| `counts/by_theme.json` | Counts and transcript_id evidence per theme/sub-theme |
| `counts/trends.json` | Monthly (or quarterly) counts by theme and sub-theme |
| `counts/summary.json` | Totals and top themes/sub-themes |
