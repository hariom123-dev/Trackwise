# TrackWise: Enterprise Predictive Business Intelligence & Analytics SaaS

TrackWise is a production-ready, full-stack predictive business intelligence SaaS platform. It combines deterministic unit economics modeling, Google Gemini AI strategic recommendations, multi-period financial ingestion, interactive data visualizers, and secure Razorpay payment processing.

---

## 🚀 Key Features

### 1. 🗄️ Self-Contained SQLite Database (`better-sqlite3`)
- Zero external database credentials required—runs seamlessly out of the box with local `trackwise.db`.
- Full relational schema with foreign key constraints, indexes, and cascade deletion across:
  - `users`: User profiles, bcrypt password hashes, active subscription plans, 2FA, and preferences.
  - `timeseries_records`: Multi-period financial metrics (revenue, expenses, customers, churn rate, industry).
  - `analysis_reports`: Historical strategic forecasting reports with full prediction JSON and telemetry inputs.
  - `insights`: Market intelligence signals, like counts, bookmark flags, and action checklists.
  - `payments`: Razorpay and simulated payment transaction audit logs.
- Pre-seeded with **12 months of realistic time-series records**, **2 strategic AI analysis reports**, and **4 market intelligence signals** for the default demo account.

### 2. 🔐 JWT Authentication & Authorization
- Secure JWT-based authentication using HTTP `Bearer` tokens.
- Passwords salted and hashed with `bcryptjs` (salt rounds = 10).
- React `AuthContext` with automatic Bearer token injection on API requests and automatic session expiry handling.
- Protected route wrappers guarding `/dashboard`, `/data`, `/insights`, `/subscription`, and `/settings`.
- Instant 1-click **"Fill Demo Credentials"** button on `/login` (`alex@kinetic.com` / `Password123!`).

### 3. 🧠 Resilient Dual-Engine Forecasting (Deterministic Math + Gemini AI)
- **Deterministic Math First**: Every forecast computes operating margins, net burn rate, ARPU, customer lifetime value (LTV), and MoM compound trajectory directly in TypeScript.
- **Gemini Structured Intelligence**: Prompts Google Gemini with computed parameters using structured JSON schemas to deliver executive assessments and risk scoring.
- **Graceful Fallback Mode**: If `GEMINI_API_KEY` is missing or rate limits are reached, the platform seamlessly falls back to the deterministic projection engine without disrupting user experience or raising 500 errors.

### 4. 💳 Resilient Razorpay Payments & HMAC Verification
- Real HMAC SHA256 signature verification (`crypto.createHmac('sha256', secret)`) for production orders.
- Simulated checkout mode enabled when Razorpay keys are omitted in development, allowing full end-to-end testing of tier upgrades.
- Real-time plan status badge in the sidebar and tier management UI.

### 5. 📥 Multi-Row Spreadsheet Ingestion (`SheetJS`)
- Ingests entire multi-row CSV/Excel sheets using modern `readAsArrayBuffer` + `XLSX.read(buffer, { type: 'array' })`.
- Flexible header mapping supporting common financial terms (`revenue`, `sales`, `cogs`, `expenses`, `churn`, `customers`).
- Interactive **Parsed Dataset Preview Table** to inspect and verify rows before database commit.
- Downloadable 6-month sample CSV template for instant testing.

### 6. 📊 Interactive Executive Dashboard (`Recharts`)
- Replaced static mock placeholders with rich `ResponsiveContainer` + `ComposedChart` / `AreaChart` components.
- Live telemetry with `Monthly` and `Weekly` granularity toggles.
- Dynamic `7d / 30d / 90d / 12m` time window filters recalculating Period Revenue, Active Customers, Operating Margin, and Net Retention.
- Dynamic top performing segment breakdowns and system alerts.
- Working shareable report links (`/dashboard?reportId=...` and `/reports/:id`) with one-click clipboard copying.
- Full executive report PDF export via `html2canvas` + `jspdf`.

### 7. 💡 Live Market Intelligence Signals
- Real-time market signals loaded from SQLite with search and category tag filters.
- Persisted bookmark toggles, reactions, and interactive action item checklists.
- Autonomous **"Run Intelligence Scan"** tool synthesizing new market opportunities on demand.

### 9. 🤖 Context-Aware AI Financial Analyst Copilot
- Slide-over drawer (`src/components/AICopilotDrawer.tsx`) accessible via a floating "Ask AI Analyst" button and header shortcut.
- Grounded in SQLite financial telemetry: answers using exact user numbers, MoM growth, operating margins, churn rate, and Rule of 40 score.
- Full SQLite persistence (`chat_messages`) with conversation reset and re-seeding.
- 1-click Quick Prompt Chips for unit economics diagnosis, margin/churn risks, runway forecasts, and investor briefings.
- Resilient dual-engine response generation: Google Gemini 2.5/3.1 with an intelligent quantitative deterministic CFO fallback.

### 10. 🎛️ Interactive "What-If" Scenario & Sensitivity Simulator
- Real-time sensitivity modeling (`src/components/WhatIfScenarioSimulator.tsx`) in the Data Lab.
- 4 interactive dynamic sliders:
  1. Price / ARPU Shift (`-20%` to `+50%`)
  2. Monthly Churn Reduction (`-3.0%` to `+3.0%`)
  3. Outbound / Growth Boost (`-10%` to `+30%`)
  4. Operating Expense Adjustment (`-30%` to `+50%`)
- Dual-curve live Recharts (`ComposedChart`) comparing baseline vs. simulated 6-month trajectory and net operating profit with live cumulative delta calculations.

### 11. 🏆 Executive SaaS Unit Economics Scorecard
- Real-time calculations of Rule of 40 Score (`Annualized Growth % + Operating Margin %`) with status badges (`Elite >40%`, `Healthy 20-40%`, `Needs Focus <20%`).
- Customer Lifetime Value (LTV), ARPU, LTV:CAC Multiple, estimated payback period, monthly net operating surplus, and capital runway.

### 12. 🔔 Live Anomaly Detection & Activity Audit Log
- Continuous anomaly detection hooks in time-series ingestion and AI predictions:
  - Spiked churn (`> 5.0%`)
  - Elevated operating burn (`expenses > 90% of revenue`)
  - Revenue expansion milestones (`> 15% MoM`)
- Real-time unread notification count on the header Bell icon.
- Interactive Workspace Activity & Audit Log Modal displaying cryptographically tracked timestamps and actions from SQLite `audit_logs`.

### 13. 📑 Multi-Sheet Excel Workbook Export (`.xlsx`)
- 1-click download of a 3-sheet `.xlsx` model containing `Historical_TimeSeries`, `AI_6Month_Forecast`, and `Unit_Economics_Summary`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons, Motion (Framer Motion), Recharts 3.8, Sonner |
| **Backend** | Node.js, Express 4.21, `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, `zod`, `express-rate-limit` |
| **AI / Machine Learning** | Google GenAI SDK (`@google/genai`), Deterministic Financial Modeling Engine |
| **Data & Files** | SheetJS (`xlsx`), `jspdf`, `html2canvas` |
| **Payments** | Razorpay Node SDK with HMAC SHA256 Signature Verification |

---

## 🏁 Quickstart & Installation

### 1. Prerequisites
- Node.js `>= 18.0.0` (Tested on Node 20, 22, and 24)
- npm `>= 9.0.0`

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` (optional for development—TrackWise runs out-of-the-box with defaults):
```bash
cp .env.example .env
```

| Variable | Description | Default / Fallback |
|---|---|---|
| `PORT` | Web server listening port | `3000` |
| `JWT_SECRET` | Secret key for signing user JWT tokens | Internal secure fallback |
| `GEMINI_API_KEY` | Google Gemini API key | Optional (Falls back to deterministic engine) |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Key ID | Optional (Falls back to simulated checkout) |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Secret | Optional (Falls back to simulated verification) |

### 4. Run Development Server
```bash
npm run dev
```
Visit `http://localhost:3000` in your browser.

---

## 🔑 Default Demo Credentials

You can sign in immediately using the pre-seeded demo account or click **"Fill Demo"** on `/login`:
- **Email:** `alex@kinetic.com`
- **Password:** `Password123!`
- **Role:** `Lead Strategist at Kinetic Global`

---

## 🧪 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start full-stack application (Vite dev middleware + Express API) |
| `npm run build` | Compile and bundle production frontend into `dist/` |
| `npm run start` | Run server in production mode |
| `npm run lint` | Execute TypeScript type-checking (`tsc --noEmit`) |

---

## 📡 REST API Documentation

### Authentication & User
- `POST /api/auth/register` - Create user account with seeded time-series starter records
- `POST /api/auth/login` - Authenticate credentials and receive Bearer JWT
- `GET /api/auth/me` - Fetch authenticated user profile and subscription status
- `PUT /api/user/profile` - Update user name, email, phone, role, timezone, or compressed avatar
- `PUT /api/user/password` - Verify current password and set new password
- `PUT /api/user/preferences` - Update notifications, integrations, or 2FA flags
- `POST /api/user/api-key/regenerate` - Generate a new `tw_live_...` developer key
- `DELETE /api/user/account` - Cascade delete user and all associated records

### Time-Series & Predictions
- `GET /api/data/timeseries` - Fetch historical records and previous analysis reports
- `POST /api/data/timeseries/bulk` - Ingest multi-row dataset (validated via Zod)
- `POST /api/gemini/predict` - Run deterministic math + Gemini strategic forecasting
- `GET /api/reports/:id` - Fetch individual report by ID (supporting shared report URLs)

### Market Intelligence
- `GET /api/insights` - Load market signals for user
- `POST /api/insights/scan` - Synthesize a new market intelligence signal
- `POST /api/insights/:id/toggle-like` - Increment/decrement reaction counter
- `POST /api/insights/:id/toggle-save` - Toggle saved bookmark status
- `PUT /api/insights/:id/actions` - Persist completed action checklist state

### AI Financial Copilot
- `GET /api/copilot/messages` - Retrieve user's persisted copilot chat history
- `POST /api/copilot/ask` - Submit financial query; returns ground-truth CFO analysis with metrics snapshot
- `DELETE /api/copilot/messages` - Reset chat history and re-seed welcome telemetry

### Live Notifications & Activity Audit Logs
- `GET /api/notifications` - Retrieve live anomaly notifications, unread count, and latest 25 audit logs
- `POST /api/notifications/mark-read` - Mark specific notification or all notifications as read

### Payments
- `POST /api/razorpay/create-order` - Create Razorpay order or simulated order
- `POST /api/razorpay/verify` - Verify HMAC SHA256 signature and upgrade user plan

---

## 📜 License
MIT License. © 2026 TrackWise Inc. All Rights Reserved.
