import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const DB_PATH = path.resolve(process.cwd(), "trackwise.db");

// Initialize SQLite database instance
export const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better concurrency and performance
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

/**
 * Initialize database schema and tables if they don't exist
 */
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT,
      timezone TEXT,
      avatar TEXT,
      api_key TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      notifications_json TEXT,
      integrations_json TEXT,
      plan_id TEXT DEFAULT 'free',
      plan_interval TEXT DEFAULT 'monthly',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timeseries_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      period TEXT NOT NULL,
      revenue REAL NOT NULL,
      expenses REAL NOT NULL,
      customers INTEGER NOT NULL,
      churn_rate REAL NOT NULL,
      industry TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      industry TEXT NOT NULL,
      summary TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      efficiency_score REAL NOT NULL,
      input_data_json TEXT NOT NULL,
      prediction_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      desc TEXT NOT NULL,
      full_content TEXT NOT NULL,
      tag TEXT NOT NULL,
      image TEXT NOT NULL,
      author TEXT NOT NULL,
      avatar TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      date TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      liked_by_user INTEGER DEFAULT 0,
      saved_by_user INTEGER DEFAULT 0,
      action_items_json TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      payment_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      interval TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metrics_snapshot_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_timeseries_user_period ON timeseries_records(user_id, period);
    CREATE INDEX IF NOT EXISTS idx_reports_user ON analysis_reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_messages(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at);
  `);

  seedDemoData();
}

/**
 * Log user activity into audit_logs and optionally create a notification
 */
export function logUserActivity(
  userId: string,
  action: string,
  details: string,
  optionalNotification?: { title: string; text: string; type: "success" | "warning" | "info" }
) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run("log_" + crypto.randomUUID(), userId, action, details, now);

  if (optionalNotification) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, text, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(
      "notif_" + crypto.randomUUID(),
      userId,
      optionalNotification.title,
      optionalNotification.text,
      optionalNotification.type,
      now
    );
  }
}

/**
 * Seed initial demo user and rich enterprise data if not present
 */
function seedDemoData() {
  const demoEmail = "alex@kinetic.com";
  const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(demoEmail) as any;

  let demoUserId = existingUser ? existingUser.id : "user_demo_alex_sterling";

  if (!existingUser) {
    const passwordHash = bcrypt.hashSync("Password123!", 10);
    const notifications = JSON.stringify({
      email: true,
      push: true,
      weekly: true,
      predictive: true,
    });
    const integrations = JSON.stringify([
      { id: "ga", name: "Google Analytics", status: "Connected" },
      { id: "stripe", name: "Stripe", status: "Connected" },
      { id: "slack", name: "Slack", status: "Not Connected" },
      { id: "salesforce", name: "Salesforce", status: "Not Connected" },
    ]);

    db.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, phone, role, timezone, avatar,
        api_key, two_factor_enabled, notifications_json, integrations_json,
        plan_id, plan_interval, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      demoUserId,
      "Alex Sterling",
      demoEmail,
      passwordHash,
      "+1 (555) 000-0000",
      "Lead Strategist at Kinetic Global",
      "Pacific Time (PT)",
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
      "tw_live_9f83b2a1c0d4e5f6a7b8c9d0e1f2a3b4",
      0,
      notifications,
      integrations,
      "enterprise",
      "yearly",
      new Date().toISOString()
    );

    console.log("🌱 Default demo user seeded: alex@kinetic.com / Password123!");
  }

  // Seed 12 months historical records if none exist for this user
  const recordCount = (db.prepare("SELECT COUNT(*) as count FROM timeseries_records WHERE user_id = ?").get(demoUserId) as any).count;
  if (recordCount === 0) {
    const historicalData = [
      { period: "2025-05", revenue: 45000, expenses: 34000, customers: 950, churnRate: 2.9, industry: "SaaS" },
      { period: "2025-06", revenue: 48500, expenses: 35200, customers: 1020, churnRate: 2.7, industry: "SaaS" },
      { period: "2025-07", revenue: 52000, expenses: 36800, customers: 1110, churnRate: 2.5, industry: "SaaS" },
      { period: "2025-08", revenue: 56000, expenses: 38500, customers: 1220, churnRate: 2.4, industry: "SaaS" },
      { period: "2025-09", revenue: 61500, expenses: 41000, customers: 1350, churnRate: 2.2, industry: "SaaS" },
      { period: "2025-10", revenue: 67000, expenses: 43200, customers: 1490, churnRate: 2.1, industry: "SaaS" },
      { period: "2025-11", revenue: 72500, expenses: 45800, customers: 1640, churnRate: 1.9, industry: "SaaS" },
      { period: "2025-12", revenue: 79000, expenses: 48000, customers: 1800, churnRate: 1.9, industry: "SaaS" },
      { period: "2026-01", revenue: 84500, expenses: 50500, customers: 1980, churnRate: 1.8, industry: "SaaS" },
      { period: "2026-02", revenue: 89000, expenses: 52000, customers: 2120, churnRate: 1.7, industry: "SaaS" },
      { period: "2026-03", revenue: 94500, expenses: 54500, customers: 2290, churnRate: 1.6, industry: "SaaS" },
      { period: "2026-04", revenue: 99200, expenses: 56200, customers: 2450, churnRate: 1.5, industry: "SaaS" },
    ];

    const insertRecord = db.prepare(`
      INSERT INTO timeseries_records (id, user_id, period, revenue, expenses, customers, churn_rate, industry, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows: typeof historicalData) => {
      for (const row of rows) {
        insertRecord.run(
          "ts_" + crypto.randomUUID(),
          demoUserId,
          row.period,
          row.revenue,
          row.expenses,
          row.customers,
          row.churnRate,
          row.industry,
          new Date().toISOString()
        );
      }
    });

    insertMany(historicalData);
    console.log("🌱 Seeded 12 months historical time-series records for demo user.");
  }

  // Seed 2 historical reports if none exist
  const reportCount = (db.prepare("SELECT COUNT(*) as count FROM analysis_reports WHERE user_id = ?").get(demoUserId) as any).count;
  if (reportCount === 0) {
    const report1 = {
      id: "rep_demo_01",
      userId: demoUserId,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      industry: "SaaS",
      summary: "Operational trajectory demonstrates consistent top-line acceleration with steady margin expansion. Customer acquisition velocity remains healthy while churn has stabilized at 1.5%. Unit economics support aggressive investment in enterprise acquisition.",
      riskLevel: "Low",
      efficiencyScore: 88,
      inputData: {
        revenue: 99200,
        expenses: 56200,
        customers: 2450,
        churnRate: 1.5,
        industry: "SaaS",
        goals: "Scale to $150k MRR and establish European enterprise presence"
      },
      prediction: {
        summary: "Operational trajectory demonstrates consistent top-line acceleration with steady margin expansion. Customer acquisition velocity remains healthy while churn has stabilized at 1.5%. Unit economics support aggressive investment in enterprise acquisition.",
        forecast: [
          { month: "Month 1", revenue: 105650 },
          { month: "Month 2", revenue: 112520 },
          { month: "Month 3", revenue: 119830 },
          { month: "Month 4", revenue: 127620 },
          { month: "Month 5", revenue: 135920 },
          { month: "Month 6", revenue: 144750 },
        ],
        recommendations: [
          "Deploy automated account expansion triggers for accounts exceeding 80% feature utilization.",
          "Expand localized EU compliance infrastructure (GDPR dedicated sub-processors).",
          "Optimize annual upfront payment incentives to extend cash runway beyond 24 months.",
          "Introduce tier-based SLA guarantees for high ACV enterprise contracts."
        ],
        riskLevel: "Low",
        efficiencyScore: 88
      }
    };

    const report2 = {
      id: "rep_demo_02",
      userId: demoUserId,
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      industry: "SaaS",
      summary: "Healthy SaaS fundamentals with 42.3% operating margin. Customer retention improved 15 bps MoM. Recommended focus is reducing time-to-first-value to lower onboarding drop-off.",
      riskLevel: "Low",
      efficiencyScore: 84,
      inputData: {
        revenue: 89000,
        expenses: 52000,
        customers: 2120,
        churnRate: 1.7,
        industry: "SaaS",
        goals: "Surpass $100k MRR threshold"
      },
      prediction: {
        summary: "Healthy SaaS fundamentals with 42.3% operating margin. Customer retention improved 15 bps MoM. Recommended focus is reducing time-to-first-value to lower onboarding drop-off.",
        forecast: [
          { month: "Month 1", revenue: 94780 },
          { month: "Month 2", revenue: 100950 },
          { month: "Month 3", revenue: 107510 },
          { month: "Month 4", revenue: 114500 },
          { month: "Month 5", revenue: 121940 },
          { month: "Month 6", revenue: 129870 },
        ],
        recommendations: [
          "Audit customer onboarding journey for Day 1-7 drop-off points.",
          "Formalize quarterly customer business reviews for Top 20 accounts.",
          "Migrate development and testing clusters to ARM architecture to curb cloud infrastructure overhead."
        ],
        riskLevel: "Low",
        efficiencyScore: 84
      }
    };

    const insertReport = db.prepare(`
      INSERT INTO analysis_reports (
        id, user_id, timestamp, industry, summary, risk_level, efficiency_score, input_data_json, prediction_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertReport.run(
      report1.id,
      report1.userId,
      report1.timestamp,
      report1.industry,
      report1.summary,
      report1.riskLevel,
      report1.efficiencyScore,
      JSON.stringify(report1.inputData),
      JSON.stringify(report1.prediction)
    );

    insertReport.run(
      report2.id,
      report2.userId,
      report2.timestamp,
      report2.industry,
      report2.summary,
      report2.riskLevel,
      report2.efficiencyScore,
      JSON.stringify(report2.inputData),
      JSON.stringify(report2.prediction)
    );

    console.log("🌱 Seeded 2 historical analysis reports for demo user.");
  }

  // Seed 4 insights if none exist
  const insightCount = (db.prepare("SELECT COUNT(*) as count FROM insights WHERE user_id = ?").get(demoUserId) as any).count;
  if (insightCount === 0) {
    const initialInsights = [
      {
        id: "ins_01",
        userId: demoUserId,
        title: "EMEA Expansion Opportunity",
        desc: "Unsaturated demand in DACH region for enterprise analytics tools.",
        fullContent: "Our multi-vector analysis indicates a significant gap in localized enterprise analytics within the DACH region (Germany, Austria, Switzerland). Competitors currently lack GDPR-compliant private cloud deployments which are highly valued in this sector. Recommended entry strategy: Strategic partnership with local MSPs.",
        tag: "Market Entry",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=2070",
        author: "Sarah Chen",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 89,
        date: "Oct 24, 2024",
        likes: 124,
        likedByUser: 0,
        savedByUser: 1,
        actionItems: [
          { id: "1", text: "Audit Frankfurt cloud deployment options", done: true },
          { id: "2", text: "Contact top 3 DACH managed service providers", done: false },
          { id: "3", text: "Prepare localized German marketing collateral", done: false },
        ]
      },
      {
        id: "ins_02",
        userId: demoUserId,
        title: "Retention Optimization",
        desc: "Personalized onboarding flows could reduce early-stage churn by 22%.",
        fullContent: "By analyzing user drop-off points in the first 7 days, we have identified that the technical setup phase is the primary friction point. Implementing an 'Automated Configuration Wizard' could bridge this gap. Expected impact is a 22% reduction in Day-30 churn.",
        tag: "Product",
        image: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=2070",
        author: "Alex Sterling",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 94,
        date: "Oct 22, 2024",
        likes: 256,
        likedByUser: 1,
        savedByUser: 1,
        actionItems: [
          { id: "1", text: "Design 3-step setup wizard prototype", done: true },
          { id: "2", text: "Run A/B test on self-serve cohort", done: false },
          { id: "3", text: "Review friction telemetry with UX team", done: true },
        ]
      },
      {
        id: "ins_03",
        userId: demoUserId,
        title: "Infrastructure Efficiency",
        desc: "Cloud compute costs projected to rise. Optimization recommended.",
        fullContent: "Global server costs are trending upwards by 8% quarterly. Our analysis suggests that migrating non-critical legacy workloads to ARM-based instances could reduce compute overhead by $12k/month without impacting SLA benchmarks.",
        tag: "Operations",
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070",
        author: "System AI",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 97,
        date: "Oct 20, 2024",
        likes: 89,
        likedByUser: 0,
        savedByUser: 0,
        actionItems: [
          { id: "1", text: "Benchmark test workload on Graviton/ARM instances", done: true },
          { id: "2", text: "Configure auto-scaling down during non-peak UTC hours", done: false },
        ]
      },
      {
        id: "ins_04",
        userId: demoUserId,
        title: "AI Feature Prioritization",
        desc: "Users are searching for predictive resource allocation tool.",
        fullContent: "Search query analysis within the product dashboard shows a 300% spike in users looking for 'Resource Forecasting.' Building this as a high-tier feature could drive a 12% expansion in ARPU.",
        tag: "Product",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=2070",
        author: "David Park",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 82,
        date: "Oct 18, 2024",
        likes: 167,
        likedByUser: 0,
        savedByUser: 0,
        actionItems: [
          { id: "1", text: "Draft spec for Resource Allocation forecasting module", done: false },
          { id: "2", text: "Survey 30 enterprise tier customers", done: false },
        ]
      }
    ];

    const insertInsight = db.prepare(`
      INSERT INTO insights (
        id, user_id, title, desc, full_content, tag, image, author, avatar, confidence, date,
        likes, liked_by_user, saved_by_user, action_items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ins of initialInsights) {
      insertInsight.run(
        ins.id,
        ins.userId,
        ins.title,
        ins.desc,
        ins.fullContent,
        ins.tag,
        ins.image,
        ins.author,
        ins.avatar,
        ins.confidence,
        ins.date,
        ins.likes,
        ins.likedByUser,
        ins.savedByUser,
        JSON.stringify(ins.actionItems)
      );
    }

    console.log("🌱 Seeded 4 initial strategic insights for demo user.");
  }

  // Seed Notifications if none exist
  const notifCount = (db.prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ?").get(demoUserId) as any).count;
  if (notifCount === 0) {
    const initialNotifs = [
      {
        id: "notif_01",
        userId: demoUserId,
        title: "Revenue Milestone Reached",
        text: "Monthly revenue reached $99,200 with an exceptional 43.3% operating margin.",
        type: "success",
        isRead: 0,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "notif_02",
        userId: demoUserId,
        title: "Retention Efficiency Stable",
        text: "Customer churn stabilized at 1.5% MoM, well below the 3.0% SaaS benchmark threshold.",
        type: "info",
        isRead: 0,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "notif_03",
        userId: demoUserId,
        title: "Anomaly Scan Completed",
        text: "Autonomous anomaly check finished. Zero high-volatility financial vectors detected.",
        type: "info",
        isRead: 1,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const insertNotif = db.prepare(`
      INSERT INTO notifications (id, user_id, title, text, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const n of initialNotifs) {
      insertNotif.run(n.id, n.userId, n.title, n.text, n.type, n.isRead, n.createdAt);
    }
    console.log("🌱 Seeded initial notifications for demo user.");
  }

  // Seed Audit Logs if none exist
  const auditCount = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ?").get(demoUserId) as any).count;
  if (auditCount === 0) {
    const initialLogs = [
      {
        id: "log_01",
        userId: demoUserId,
        action: "TELEMETRY_INGESTION",
        details: "Imported 12 months historical ledger records via multi-row pipeline.",
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "log_02",
        userId: demoUserId,
        action: "PREDICTION_GENERATED",
        details: "Executed Dual Forecasting Engine for SaaS vertical with compound growth modeling.",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "log_03",
        userId: demoUserId,
        action: "SECURITY_KEY_ACCESSED",
        details: "API token accessed from workspace developer settings.",
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "log_04",
        userId: demoUserId,
        action: "INTELLIGENCE_SCAN_EXECUTED",
        details: "Synthesized DACH regional enterprise expansion signal.",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const insertLog = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const l of initialLogs) {
      insertLog.run(l.id, l.userId, l.action, l.details, l.createdAt);
    }
    console.log("🌱 Seeded initial audit logs for demo user.");
  }

  // Seed Initial Chat Message if none exist
  const chatCount = (db.prepare("SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ?").get(demoUserId) as any).count;
  if (chatCount === 0) {
    const welcomeMsg = {
      id: "chat_init_01",
      userId: demoUserId,
      role: "assistant",
      content: "Hello Alex! I have loaded your 12-month financial telemetry. With your current revenue at $99,200/mo, operating margins at 43.3%, and customer churn at 1.5%, your business demonstrates exceptional capital efficiency (Rule of 40 score ~55%). How can I assist with your capital allocation, sensitivity models, or runway forecasts today?",
      metricsSnapshot: JSON.stringify({
        revenue: 99200,
        expenses: 56200,
        margin: 43.3,
        churn: 1.5,
        customers: 2450,
      }),
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    };

    db.prepare(`
      INSERT INTO chat_messages (id, user_id, role, content, metrics_snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(welcomeMsg.id, welcomeMsg.userId, welcomeMsg.role, welcomeMsg.content, welcomeMsg.metricsSnapshot, welcomeMsg.createdAt);

    console.log("🌱 Seeded initial AI copilot message for demo user.");
  }
}
