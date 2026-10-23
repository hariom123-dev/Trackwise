import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db, initDatabase } from "./server/db.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
initDatabase();

const JWT_SECRET = process.env.JWT_SECRET || "trackwise_production_jwt_secret_key_2026";
const PORT = Number(process.env.PORT) || 3000;

// Resilient API Key checking (Log warning instead of process.exit(1))
const requiredEnvVars = ["GEMINI_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar] || process.env[envVar]?.startsWith("your_")
);

if (missingEnvVars.length > 0) {
  console.warn(
    `⚠️ Notice: Optional credentials [${missingEnvVars.join(", ")}] are unconfigured or placeholder.`
  );
  console.warn("🛡️ TrackWise running in resilient mode with deterministic forecasting & simulated checkout enabled.");
}

let razorpayClient: Razorpay | null = null;
let genAIClient: GoogleGenAI | null = null;

function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.startsWith("your_") || keySecret.startsWith("your_")) {
    return null;
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayClient;
}

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Format user database row for client consumption
 */
function sanitizeUser(userRow: any) {
  let notifications = { email: true, push: true, weekly: true, predictive: true };
  let integrations: any[] = [];
  try {
    if (userRow.notifications_json) notifications = JSON.parse(userRow.notifications_json);
  } catch {}
  try {
    if (userRow.integrations_json) integrations = JSON.parse(userRow.integrations_json);
  } catch {}

  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    phone: userRow.phone || "",
    role: userRow.role || "",
    timezone: userRow.timezone || "Pacific Time (PT)",
    avatar: userRow.avatar || "",
    apiKey: userRow.api_key || "",
    twoFactorEnabled: Boolean(userRow.two_factor_enabled),
    notifications,
    integrations,
    planId: userRow.plan_id || "free",
    planInterval: userRow.plan_interval || "monthly",
    createdAt: userRow.created_at,
  };
}

/**
 * JWT Authentication Middleware
 */
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. Authentication token required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.userId) as any;
    if (!userRow) {
      return res.status(401).json({ error: "User session is invalid or user no longer exists." });
    }
    (req as any).user = sanitizeUser(userRow);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Deterministic Financial Math Engine
 */
function computeDeterministicForecast(data: {
  revenue: number;
  expenses: number;
  customers: number;
  churnRate: number;
  industry: string;
  goals: string;
  historyRows?: Array<{ revenue: number; expenses: number; period: string }>;
}) {
  const { revenue, expenses, customers, churnRate, industry, goals, historyRows } = data;

  const operatingMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const netBurnRate = Math.max(0, expenses - revenue);
  const arpu = customers > 0 ? revenue / customers : 0;
  const ltv = churnRate > 0 ? arpu / (churnRate / 100) : arpu * 24;

  // Calculate historical compound growth if multi-month records are provided
  let monthlyGrowthRate = 0.05; // 5% baseline
  if (historyRows && historyRows.length >= 2) {
    const sorted = [...historyRows].sort((a, b) => a.period.localeCompare(b.period));
    const first = sorted[0].revenue;
    const last = sorted[sorted.length - 1].revenue;
    const months = sorted.length - 1;
    if (first > 0 && last > 0 && months > 0) {
      monthlyGrowthRate = Math.pow(last / first, 1 / months) - 1;
      monthlyGrowthRate = Math.max(-0.2, Math.min(0.25, monthlyGrowthRate));
    }
  }

  // Adjust net growth factor with churn impact
  const netMonthlyRate = monthlyGrowthRate - (churnRate / 100) * 0.5;

  const forecast = [];
  let currentRev = revenue;
  for (let i = 1; i <= 6; i++) {
    currentRev = Math.max(0, currentRev * (1 + netMonthlyRate));
    forecast.push({
      month: `Month ${i}`,
      revenue: Math.round(currentRev),
    });
  }

  // Determine Risk Level
  let riskLevel: "Low" | "Medium" | "High" = "Low";
  if (churnRate > 5.0 || operatingMargin < 5) {
    riskLevel = "High";
  } else if (churnRate > 2.5 || operatingMargin < 20) {
    riskLevel = "Medium";
  }

  // Determine Operational Efficiency Score (0 - 100)
  let efficiencyScore = 50;
  efficiencyScore += Math.min(30, Math.max(-20, Math.round(operatingMargin * 0.7)));
  efficiencyScore -= Math.min(25, Math.round(churnRate * 4));
  if (monthlyGrowthRate > 0) efficiencyScore += Math.min(20, Math.round(monthlyGrowthRate * 100));
  efficiencyScore = Math.max(15, Math.min(99, efficiencyScore));

  // Determine Grounded Strategic Recommendations
  const recommendations: string[] = [];
  if (churnRate > 3.0) {
    recommendations.push(
      `Deploy automated telemetry-driven retention triggers to address the ${churnRate.toFixed(1)}% churn rate before customer Day-30.`
    );
  } else {
    recommendations.push(
      `Leverage the strong ${(100 - churnRate).toFixed(1)}% customer retention rate to introduce upsell/tier expansion paths.`
    );
  }

  if (operatingMargin < 25) {
    recommendations.push(
      `Audit monthly operational expenditures ($${expenses.toLocaleString()}) to improve operating margin towards the 30% industry benchmark.`
    );
  } else {
    recommendations.push(
      `Sustain healthy ${operatingMargin.toFixed(1)}% operating margins by reinvesting retained profits into localized enterprise sales channels.`
    );
  }

  recommendations.push(
    `Target an estimated ARPU expansion to $${(arpu * 1.15).toFixed(2)} to accelerate your objective: "${goals}".`
  );
  recommendations.push(
    `Formalize quarterly business review cadence for top 20% ACV customers representing primary lifetime value ($${ltv.toFixed(0)} LTV).`
  );

  const summary = `Based on current financial telemetry in ${industry}, operating margin stands at ${operatingMargin.toFixed(
    1
  )}% with an estimated customer LTV of $${ltv.toFixed(0)}. With net monthly momentum of ${(
    netMonthlyRate * 100
  ).toFixed(1)}%, 6-month projected revenue reaches $${forecast[5].revenue.toLocaleString()}.`;

  return {
    summary,
    forecast,
    recommendations,
    riskLevel,
    efficiencyScore,
    deterministicMetrics: {
      operatingMargin: Number(operatingMargin.toFixed(2)),
      netBurnRate: Math.round(netBurnRate),
      arpu: Number(arpu.toFixed(2)),
      ltv: Number(ltv.toFixed(2)),
      monthlyGrowthRate: Number((monthlyGrowthRate * 100).toFixed(2)),
    },
  };
}

async function startServer() {
  const app = express();

  // Rate Limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many authentication requests, please try again in 15 minutes." },
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: "API rate limit exceeded. Please try again shortly." },
  });

  app.use(express.json({ limit: "10mb" }));
  app.use("/api/", apiLimiter);

  // ==========================================
  // Health Check
  // ==========================================
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      aiEngine: getGenAI() ? "gemini-active" : "deterministic-fallback",
      paymentGateway: getRazorpay() ? "razorpay-live" : "simulated-mode",
    });
  });

  // ==========================================
  // Auth Routes
  // ==========================================
  const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.string().optional(),
  });

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const { name, email, password, role } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }

      const userId = "usr_" + crypto.randomUUID();
      const passwordHash = bcrypt.hashSync(password, 10);
      const apiKey = "tw_live_" + crypto.randomBytes(16).toString("hex");

      const notifications = JSON.stringify({
        email: true,
        push: true,
        weekly: true,
        predictive: true,
      });

      const integrations = JSON.stringify([
        { id: "ga", name: "Google Analytics", status: "Connected" },
        { id: "stripe", name: "Stripe", status: "Not Connected" },
        { id: "slack", name: "Slack", status: "Not Connected" },
        { id: "salesforce", name: "Salesforce", status: "Not Connected" },
      ]);

      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (
          id, name, email, password_hash, role, timezone, avatar,
          api_key, two_factor_enabled, notifications_json, integrations_json,
          plan_id, plan_interval, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        name,
        normalizedEmail,
        passwordHash,
        role || "Executive Analyst",
        "Pacific Time (PT)",
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        apiKey,
        0,
        notifications,
        integrations,
        "free",
        "monthly",
        now
      );

      // Seed starter 3 months of time-series data for new user
      const starterRecords = [
        { period: "2026-02", revenue: 38000, expenses: 26000, customers: 850, churnRate: 2.2, industry: "SaaS" },
        { period: "2026-03", revenue: 43500, expenses: 28000, customers: 980, churnRate: 2.0, industry: "SaaS" },
        { period: "2026-04", revenue: 50000, expenses: 31000, customers: 1120, churnRate: 1.8, industry: "SaaS" },
      ];

      const insertStarter = db.prepare(`
        INSERT INTO timeseries_records (id, user_id, period, revenue, expenses, customers, churn_rate, industry, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const rec of starterRecords) {
        insertStarter.run(
          "ts_" + crypto.randomUUID(),
          userId,
          rec.period,
          rec.revenue,
          rec.expenses,
          rec.customers,
          rec.churnRate,
          rec.industry,
          now
        );
      }

      const createdUserRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      const user = sanitizeUser(createdUserRow);
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

      res.status(201).json({ token, user });
    } catch (err: any) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Failed to register account." });
    }
  });

  const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  });

  app.post("/api/auth/login", authLimiter, (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const { email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail) as any;
      if (!userRow) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const match = bcrypt.compareSync(password, userRow.password_hash);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const user = sanitizeUser(userRow);
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

      res.json({ token, user });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Failed to authenticate." });
    }
  });

  app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // ==========================================
  // User Profile & Settings Routes
  // ==========================================
  app.put("/api/user/profile", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const { name, email, phone, role, timezone, avatar } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, phone = ?, role = ?, timezone = ?, avatar = ?
        WHERE id = ?
      `).run(
        name.trim(),
        email.toLowerCase().trim(),
        phone || "",
        role || "",
        timezone || "Pacific Time (PT)",
        avatar || user.avatar,
        user.id
      );

      const updatedRow = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
      res.json({ user: sanitizeUser(updatedRow) });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update profile." });
    }
  });

  app.put("/api/user/password", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters." });
      }

      const userRow = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as any;
      if (!bcrypt.compareSync(currentPassword, userRow.password_hash)) {
        return res.status(400).json({ error: "Current password does not match." });
      }

      const newHash = bcrypt.hashSync(newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

      res.json({ success: true, message: "Password updated successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update password." });
    }
  });

  app.put("/api/user/preferences", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const { notifications, integrations, twoFactorEnabled } = req.body;

      const updates: string[] = [];
      const values: any[] = [];

      if (notifications !== undefined) {
        updates.push("notifications_json = ?");
        values.push(JSON.stringify(notifications));
      }
      if (integrations !== undefined) {
        updates.push("integrations_json = ?");
        values.push(JSON.stringify(integrations));
      }
      if (twoFactorEnabled !== undefined) {
        updates.push("two_factor_enabled = ?");
        values.push(twoFactorEnabled ? 1 : 0);
      }

      if (updates.length > 0) {
        values.push(user.id);
        db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      }

      const updatedRow = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
      res.json({ user: sanitizeUser(updatedRow) });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update preferences." });
    }
  });

  app.post("/api/user/api-key/regenerate", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const newApiKey = "tw_live_" + crypto.randomBytes(16).toString("hex");
      db.prepare("UPDATE users SET api_key = ? WHERE id = ?").run(newApiKey, user.id);
      res.json({ apiKey: newApiKey });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to regenerate API key." });
    }
  });

  app.delete("/api/user/account", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
      res.json({ success: true, message: "Account deleted." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete account." });
    }
  });

  // ==========================================
  // Time-Series Data Routes
  // ==========================================
  app.get("/api/data/timeseries", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const records = db
        .prepare("SELECT * FROM timeseries_records WHERE user_id = ? ORDER BY period ASC")
        .all(user.id) as any[];

      const formattedRecords = records.map((r) => ({
        id: r.id,
        period: r.period,
        revenue: r.revenue,
        expenses: r.expenses,
        customers: r.customers,
        churnRate: r.churn_rate,
        industry: r.industry,
        createdAt: r.created_at,
      }));

      const reports = db
        .prepare("SELECT * FROM analysis_reports WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10")
        .all(user.id) as any[];

      const formattedReports = reports.map((rep) => ({
        id: rep.id,
        timestamp: rep.timestamp,
        industry: rep.industry,
        summary: rep.summary,
        riskLevel: rep.risk_level,
        efficiencyScore: rep.efficiency_score,
        inputData: JSON.parse(rep.input_data_json || "{}"),
        prediction: JSON.parse(rep.prediction_json || "{}"),
      }));

      res.json({ records: formattedRecords, reports: formattedReports });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch time-series data." });
    }
  });

  const rowSchema = z.object({
    period: z.string().min(1, "Period is required"),
    revenue: z.number().min(0, "Revenue cannot be negative"),
    expenses: z.number().min(0, "Expenses cannot be negative"),
    customers: z.number().int().min(0, "Customers cannot be negative"),
    churnRate: z.number().min(0).max(100, "Churn rate must be 0-100%"),
    industry: z.string().optional(),
  });

  const bulkTimeseriesSchema = z.object({
    rows: z.array(rowSchema).min(1, "At least one row is required"),
  });

  app.post("/api/data/timeseries/bulk", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const parsed = bulkTimeseriesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const rows = parsed.data.rows;
      const now = new Date().toISOString();

      const insertOrUpdate = db.prepare(`
        INSERT INTO timeseries_records (id, user_id, period, revenue, expenses, customers, churn_rate, industry, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((items: typeof rows) => {
        for (const r of items) {
          insertOrUpdate.run(
            "ts_" + crypto.randomUUID(),
            user.id,
            r.period,
            r.revenue,
            r.expenses,
            r.customers,
            r.churnRate,
            r.industry || "General Business",
            now
          );
        }
      });

      insertMany(rows);

      // Return updated records
      const updated = db
        .prepare("SELECT * FROM timeseries_records WHERE user_id = ? ORDER BY period ASC")
        .all(user.id) as any[];

      res.json({
        success: true,
        count: rows.length,
        records: updated.map((r) => ({
          id: r.id,
          period: r.period,
          revenue: r.revenue,
          expenses: r.expenses,
          customers: r.customers,
          churnRate: r.churn_rate,
          industry: r.industry,
        })),
      });
    } catch (err: any) {
      console.error("Bulk upload error:", err);
      res.status(500).json({ error: "Failed to store time-series records." });
    }
  });

  // ==========================================
  // Gemini AI & Deterministic Prediction Engine
  // ==========================================
  const predictSchema = z.object({
    revenue: z.number().min(0, "Revenue cannot be negative"),
    expenses: z.number().min(0, "Expenses cannot be negative"),
    customers: z.number().int().min(0, "Customers must be an integer"),
    churnRate: z.number().min(0).max(100, "Churn rate must be between 0 and 100%"),
    industry: z.string().min(1, "Industry is required"),
    goals: z.string().min(1, "Goals are required"),
    historyRows: z
      .array(
        z.object({
          period: z.string(),
          revenue: z.number(),
          expenses: z.number(),
        })
      )
      .optional(),
  });

  app.post("/api/gemini/predict", authenticateToken, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsed = predictSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const input = parsed.data;

      // 1. Always run deterministic financial math first
      const deterministicResult = computeDeterministicForecast(input);

      let finalReport = {
        summary: deterministicResult.summary,
        forecast: deterministicResult.forecast,
        recommendations: deterministicResult.recommendations,
        riskLevel: deterministicResult.riskLevel,
        efficiencyScore: deterministicResult.efficiencyScore,
      };

      // 2. Try Gemini AI if available and key configured
      const ai = getGenAI();
      if (ai) {
        try {
          const prompt = `
            Analyze this business intelligence profile and generate an executive predictive intelligence report.
            
            FINANCIAL PROFILE & COMPUTED METRICS:
            - Industry: ${input.industry}
            - Current Monthly Revenue: $${input.revenue}
            - Current Monthly Expenses: $${input.expenses}
            - Active Customers: ${input.customers}
            - Churn Rate: ${input.churnRate}%
            - Operating Margin: ${deterministicResult.deterministicMetrics.operatingMargin}%
            - ARPU: $${deterministicResult.deterministicMetrics.arpu}
            - Estimated LTV: $${deterministicResult.deterministicMetrics.ltv}
            - Business Goals: ${input.goals}
            - Baseline 6-Month Projection: ${JSON.stringify(deterministicResult.forecast)}

            REQUIREMENTS:
            1. SUMMARY: 2-3 sentence expert C-level assessment synthesizing current performance and trajectory.
            2. FORECAST: Refine the 6-month projected revenue array (month and revenue integer).
            3. RECOMMENDATIONS: Exactly 4 distinct, highly actionable strategic directives tailored to their exact goals and margins.
            4. RISK LEVEL: "Low", "Medium", or "High".
            5. EFFICIENCY SCORE: Number 0-100 evaluating operational efficiency.
          `;

          const aiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              systemInstruction:
                "You are an elite quantitative business strategist. Provide grounded, analytical executive reports in JSON format matching the schema.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  forecast: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        month: { type: Type.STRING },
                        revenue: { type: Type.NUMBER },
                      },
                      required: ["month", "revenue"],
                    },
                  },
                  recommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  riskLevel: {
                    type: Type.STRING,
                    enum: ["Low", "Medium", "High"],
                  },
                  efficiencyScore: { type: Type.NUMBER },
                },
                required: ["summary", "forecast", "recommendations", "riskLevel", "efficiencyScore"],
              },
            },
          });

          if (aiResponse.text) {
            const aiData = JSON.parse(aiResponse.text);
            finalReport = {
              summary: aiData.summary || finalReport.summary,
              forecast: Array.isArray(aiData.forecast) ? aiData.forecast : finalReport.forecast,
              recommendations: Array.isArray(aiData.recommendations) ? aiData.recommendations : finalReport.recommendations,
              riskLevel: aiData.riskLevel || finalReport.riskLevel,
              efficiencyScore: typeof aiData.efficiencyScore === "number" ? aiData.efficiencyScore : finalReport.efficiencyScore,
            };
          }
        } catch (aiErr) {
          console.warn("⚠️ Gemini AI generation fell back to deterministic financial engine:", (aiErr as any)?.message);
        }
      }

      // Save report to SQLite
      const reportId = "rep_" + crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO analysis_reports (
          id, user_id, timestamp, industry, summary, risk_level, efficiency_score, input_data_json, prediction_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reportId,
        user.id,
        now,
        input.industry,
        finalReport.summary,
        finalReport.riskLevel,
        finalReport.efficiencyScore,
        JSON.stringify(input),
        JSON.stringify(finalReport)
      );

      res.json({
        id: reportId,
        timestamp: now,
        industry: input.industry,
        summary: finalReport.summary,
        riskLevel: finalReport.riskLevel,
        efficiencyScore: finalReport.efficiencyScore,
        inputData: input,
        prediction: finalReport,
      });
    } catch (err: any) {
      console.error("Prediction error:", err);
      res.status(500).json({ error: err.message || "Failed to generate prediction" });
    }
  });

  // Public/Shared Report Route
  app.get("/api/reports/:id", (req, res) => {
    try {
      const report = db.prepare("SELECT * FROM analysis_reports WHERE id = ?").get(req.params.id) as any;
      if (!report) {
        return res.status(404).json({ error: "Analysis report not found." });
      }

      res.json({
        id: report.id,
        timestamp: report.timestamp,
        industry: report.industry,
        summary: report.summary,
        riskLevel: report.risk_level,
        efficiencyScore: report.efficiency_score,
        inputData: JSON.parse(report.input_data_json || "{}"),
        prediction: JSON.parse(report.prediction_json || "{}"),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve report." });
    }
  });

  // ==========================================
  // Market Intelligence & Signals
  // ==========================================
  app.get("/api/insights", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const rows = db.prepare("SELECT * FROM insights WHERE user_id = ? ORDER BY date DESC").all(user.id) as any[];

      const insights = rows.map((r) => ({
        id: r.id,
        title: r.title,
        desc: r.desc,
        fullContent: r.full_content,
        tag: r.tag,
        image: r.image,
        author: r.author,
        avatar: r.avatar,
        confidence: r.confidence,
        date: r.date,
        likes: r.likes,
        likedByUser: Boolean(r.liked_by_user),
        savedByUser: Boolean(r.saved_by_user),
        actionItems: JSON.parse(r.action_items_json || "[]"),
      }));

      res.json({ insights });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load market insights." });
    }
  });

  app.post("/api/insights/scan", authenticateToken, async (req, res) => {
    try {
      const user = (req as any).user;
      const latestTs = db
        .prepare("SELECT * FROM timeseries_records WHERE user_id = ? ORDER BY period DESC LIMIT 1")
        .get(user.id) as any;

      const industry = latestTs?.industry || "SaaS";
      const revenue = latestTs?.revenue || 85000;
      const churn = latestTs?.churn_rate || 1.8;

      let title = "Cross-Border Market Arbitrage";
      let desc = `Capital efficiency in ${industry} indicates expansion opportunities into APAC high-density hubs.`;
      let fullContent = `Based on unit economics ($${revenue.toLocaleString()} MRR with ${churn}% churn), expanding enterprise distribution into regional hubs yields favorable customer acquisition economics. Recommended pilot: 3-month regional cohort.`;
      let tag = "Market Entry";
      let confidence = 91;

      // Try generating fresh intelligence signal via Gemini if available
      const ai = getGenAI();
      if (ai) {
        try {
          const aiRes = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a high-signal strategic market intelligence advisory for a ${industry} firm with $${revenue} monthly revenue and ${churn}% churn rate. Return JSON with: title (short string), desc (1 sentence), fullContent (2-3 sentences analytical briefing), tag (one of: Market Entry, Product, Operations, Finance), confidence (integer 80-98).`,
            config: {
              responseMimeType: "application/json",
            },
          });
          if (aiRes.text) {
            const parsedAi = JSON.parse(aiRes.text);
            if (parsedAi.title) title = parsedAi.title;
            if (parsedAi.desc) desc = parsedAi.desc;
            if (parsedAi.fullContent) fullContent = parsedAi.fullContent;
            if (parsedAi.tag) tag = parsedAi.tag;
            if (parsedAi.confidence) confidence = parsedAi.confidence;
          }
        } catch (e) {
          console.warn("Scan fallback to deterministic insight:", (e as any)?.message);
        }
      }

      const id = "ins_" + crypto.randomUUID();
      const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const actions = JSON.stringify([
        { id: "1", text: "Validate TAM and competitive saturation", done: false },
        { id: "2", text: "Draft strategic executive action brief", done: false },
      ]);

      db.prepare(`
        INSERT INTO insights (
          id, user_id, title, desc, full_content, tag, image, author, avatar,
          confidence, date, likes, liked_by_user, saved_by_user, action_items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        user.id,
        title,
        desc,
        fullContent,
        tag,
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070",
        "TrackWise AI Engine",
        user.avatar || "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence,
        dateStr,
        42,
        0,
        0,
        actions
      );

      res.json({
        id,
        title,
        desc,
        fullContent,
        tag,
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070",
        author: "TrackWise AI Engine",
        avatar: user.avatar,
        confidence,
        date: dateStr,
        likes: 42,
        likedByUser: false,
        savedByUser: false,
        actionItems: JSON.parse(actions),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to scan intelligence." });
    }
  });

  app.post("/api/insights/:id/toggle-like", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const ins = db.prepare("SELECT * FROM insights WHERE id = ? AND user_id = ?").get(req.params.id, user.id) as any;
      if (!ins) return res.status(404).json({ error: "Insight not found" });

      const newLiked = ins.liked_by_user ? 0 : 1;
      const newLikes = newLiked ? ins.likes + 1 : Math.max(0, ins.likes - 1);

      db.prepare("UPDATE insights SET likes = ?, liked_by_user = ? WHERE id = ?").run(newLikes, newLiked, ins.id);

      res.json({ likes: newLikes, likedByUser: Boolean(newLiked) });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update like status." });
    }
  });

  app.post("/api/insights/:id/toggle-save", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const ins = db.prepare("SELECT * FROM insights WHERE id = ? AND user_id = ?").get(req.params.id, user.id) as any;
      if (!ins) return res.status(404).json({ error: "Insight not found" });

      const newSaved = ins.saved_by_user ? 0 : 1;
      db.prepare("UPDATE insights SET saved_by_user = ? WHERE id = ?").run(newSaved, ins.id);

      res.json({ savedByUser: Boolean(newSaved) });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to toggle bookmark." });
    }
  });

  app.put("/api/insights/:id/actions", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const { actionItems } = req.body;
      if (!Array.isArray(actionItems)) {
        return res.status(400).json({ error: "actionItems must be an array" });
      }

      db.prepare("UPDATE insights SET action_items_json = ? WHERE id = ? AND user_id = ?").run(
        JSON.stringify(actionItems),
        req.params.id,
        user.id
      );

      res.json({ success: true, actionItems });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update action items." });
    }
  });

  // ==========================================
  // Razorpay & Payments
  // ==========================================
  const planPrices: Record<string, number> = {
    "professional-monthly": 990000, // ₹9,900
    "professional-halfyearly": 5500000, // ₹55,000
    "professional-yearly": 9900000, // ₹99,000
    "enterprise-monthly": 2490000, // ₹24,900
    "enterprise-halfyearly": 12500000, // ₹125,000
    "enterprise-yearly": 22500000, // ₹225,000
  };

  app.post("/api/razorpay/create-order", authenticateToken, async (req, res) => {
    try {
      const { planId, interval } = req.body;
      const amount = planPrices[`${planId}-${interval}`];

      if (!amount) {
        return res.status(400).json({ error: "Invalid plan or billing interval." });
      }

      const client = getRazorpay();
      if (!client) {
        // Simulated checkout order for dev/testing when keys are absent
        const simulatedOrder = {
          id: `order_sim_${Date.now()}`,
          amount,
          currency: "INR",
          simulated: true,
          key: "rzp_simulated_test_key",
        };
        return res.json(simulatedOrder);
      }

      const order = await client.orders.create({
        amount,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });

      res.json({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        simulated: false,
      });
    } catch (err: any) {
      console.error("Razorpay order error:", err);
      res.status(500).json({ error: err.message || "Failed to create payment order." });
    }
  });

  app.post("/api/razorpay/verify", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planId,
        interval,
        simulated,
      } = req.body;

      if (!planId || !interval) {
        return res.status(400).json({ error: "Plan ID and interval are required." });
      }

      const amount = planPrices[`${planId}-${interval}`] || 990000;

      // Handle Simulated Orders
      if (simulated || razorpay_order_id?.startsWith("order_sim_")) {
        const paymentId = razorpay_payment_id || `pay_sim_${Date.now()}`;
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO payments (id, user_id, order_id, payment_id, plan_id, interval, amount, currency, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          "pay_" + crypto.randomUUID(),
          user.id,
          razorpay_order_id,
          paymentId,
          planId,
          interval,
          amount,
          "INR",
          "success",
          now
        );

        db.prepare("UPDATE users SET plan_id = ?, plan_interval = ? WHERE id = ?").run(planId, interval, user.id);

        const updatedRow = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
        return res.json({
          success: true,
          simulated: true,
          message: "Plan activated via simulated verification.",
          user: sanitizeUser(updatedRow),
        });
      }

      // Handle Live Razorpay Orders
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        return res.status(500).json({ error: "Razorpay secret key not configured." });
      }

      const generatedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO payments (id, user_id, order_id, payment_id, plan_id, interval, amount, currency, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "pay_" + crypto.randomUUID(),
        user.id,
        razorpay_order_id,
        razorpay_payment_id,
        planId,
        interval,
        amount,
        "INR",
        "success",
        now
      );

      db.prepare("UPDATE users SET plan_id = ?, plan_interval = ? WHERE id = ?").run(planId, interval, user.id);

      const updatedRow = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
      res.json({
        success: true,
        simulated: false,
        message: "Payment verified successfully.",
        user: sanitizeUser(updatedRow),
      });
    } catch (err: any) {
      console.error("Payment verification error:", err);
      res.status(500).json({ error: "Failed to verify payment." });
    }
  });

  // ==========================================
  // Vite Middleware & SPA Serving
  // ==========================================
  const isProduction = process.env.NODE_ENV === "production" || process.env.ENVIRONMENT === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (!fs.existsSync(distPath)) {
      console.error("❌ ERROR: 'dist' folder not found at", distPath);
      console.error("Please run 'npm run build' before starting production server.");
      process.exit(1);
    }

    app.use(express.static(distPath, { maxAge: "1d", etag: false }));

    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("index.html not found in dist");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ TrackWise server running on http://localhost:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
