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

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      currency TEXT DEFAULT 'INR',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      joined_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_timeseries_user_period ON timeseries_records(user_id, period);
    CREATE INDEX IF NOT EXISTS idx_reports_user ON analysis_reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_messages(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ws_members_ws ON workspace_members(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);
  `);

  // Ensure workspace_id column exists on isolated tables
  function ensureColumn(table: string, column: string, typeDef: string) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      if (!cols.some((c) => c.name === column)) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`).run();
      }
    } catch (err) {
      console.warn(`Could not add column ${column} to ${table}:`, err);
    }
  }

  ensureColumn("timeseries_records", "workspace_id", "TEXT");
  ensureColumn("analysis_reports", "workspace_id", "TEXT");
  ensureColumn("insights", "workspace_id", "TEXT");
  ensureColumn("chat_messages", "workspace_id", "TEXT");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
    CREATE INDEX IF NOT EXISTS idx_timeseries_ws ON timeseries_records(workspace_id, period);
    CREATE INDEX IF NOT EXISTS idx_reports_ws ON analysis_reports(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_insights_ws ON insights(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_chat_ws ON chat_messages(workspace_id, created_at);
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

  // Seed team members for multi-user collaboration
  const teamMembersToSeed = [
    {
      id: "user_priya_sharma",
      name: "Priya Sharma",
      email: "priya@kinetic.com",
      role: "Lead Financial Analyst",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
    },
    {
      id: "user_arjun_patel",
      name: "Arjun Patel",
      email: "arjun@kinetic.com",
      role: "VP Finance",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
    },
    {
      id: "user_rohan_verma",
      name: "Rohan Verma",
      email: "rohan@kinetic.com",
      role: "Senior FP&A Associate",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
    },
  ];

  for (const m of teamMembersToSeed) {
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(m.id);
    if (!existing) {
      db.prepare(`
        INSERT INTO users (
          id, name, email, password_hash, phone, role, timezone, avatar, api_key,
          two_factor_enabled, notifications_json, integrations_json, plan_id, plan_interval, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        m.id,
        m.name,
        m.email,
        bcrypt.hashSync("Password123!", 10),
        "+91 98765 43210",
        m.role,
        "Asia/Kolkata (IST)",
        m.avatar,
        "tw_live_" + crypto.randomUUID().replace(/-/g, ""),
        0,
        JSON.stringify({ email: true, app: true, weeklyReport: true }),
        JSON.stringify([]),
        "enterprise",
        "yearly",
        new Date().toISOString()
      );
    }
  }

  // 1. Seed Primary Default Workspace for Demo User
  const defaultWsId = "ws_kinetic_analytics";
  const existingDefaultWs = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(defaultWsId) as any;
  if (!existingDefaultWs) {
    db.prepare(`
      INSERT INTO workspaces (id, user_id, name, industry, currency, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(defaultWsId, demoUserId, "Kinetic SaaS Cloud", "B2B SaaS", "INR", new Date().toISOString());
    console.log("🌱 Seeded primary workspace: Kinetic SaaS Cloud");
  } else {
    db.prepare("UPDATE workspaces SET name = 'Kinetic SaaS Cloud', industry = 'B2B SaaS', currency = 'INR' WHERE id = ?").run(defaultWsId);
  }

  // Ensure all existing unassigned demo records are linked to the primary workspace
  db.prepare("UPDATE timeseries_records SET workspace_id = ? WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = '')").run(defaultWsId, demoUserId);
  db.prepare("UPDATE analysis_reports SET workspace_id = ? WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = '')").run(defaultWsId, demoUserId);
  db.prepare("UPDATE insights SET workspace_id = ? WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = '')").run(defaultWsId, demoUserId);
  db.prepare("UPDATE chat_messages SET workspace_id = ? WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = '')").run(defaultWsId, demoUserId);

  // 2. Seed Secondary Workspace: Aether AI Platform
  const secondaryWsId = "ws_aether_retail";
  const existingSecWs = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(secondaryWsId) as any;
  if (!existingSecWs) {
    db.prepare(`
      INSERT INTO workspaces (id, user_id, name, industry, currency, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(secondaryWsId, demoUserId, "Aether AI Platform", "Enterprise Software", "INR", new Date().toISOString());
    console.log("🌱 Seeded secondary workspace: Aether AI Platform");
  } else {
    db.prepare("UPDATE workspaces SET name = 'Aether AI Platform', industry = 'Enterprise Software', currency = 'INR' WHERE id = ?").run(secondaryWsId);
  }

  // Ensure any workspaces with USD are updated to INR
  db.prepare("UPDATE workspaces SET currency = 'INR' WHERE currency IS NULL OR currency = 'USD'").run();

  // Seed Workspace Members for Collaboration
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertMember.run("wm_alex_kinetic", defaultWsId, demoUserId, "admin", "2025-01-15T10:00:00Z");
  insertMember.run("wm_priya_kinetic", defaultWsId, "user_priya_sharma", "editor", "2025-02-10T11:30:00Z");
  insertMember.run("wm_arjun_kinetic", defaultWsId, "user_arjun_patel", "admin", "2025-01-20T09:15:00Z");
  insertMember.run("wm_rohan_kinetic", defaultWsId, "user_rohan_verma", "viewer", "2025-03-01T14:00:00Z");

  insertMember.run("wm_alex_aether", secondaryWsId, demoUserId, "admin", "2025-02-01T10:00:00Z");
  insertMember.run("wm_priya_aether", secondaryWsId, "user_priya_sharma", "editor", "2025-02-15T12:00:00Z");

  // Scale any existing low timeseries values by 80x to realistic INR SaaS numbers (e.g. ₹80 Lakhs MRR)
  db.prepare(`
    UPDATE timeseries_records 
    SET revenue = revenue * 80, 
        expenses = expenses * 80,
        industry = 'B2B SaaS'
    WHERE revenue < 1000000
  `).run();

  // Update existing insights ins_01 - ins_04 for B2B SaaS
  db.prepare(`
    UPDATE insights 
    SET title = 'Enterprise Tier Usage-Based Pricing Expansion',
        desc = 'Introducing hybrid usage-based tiers could drive 18% net revenue expansion.',
        full_content = 'Telemetry indicates high feature consumption across top 20% tier accounts. Transitioning from flat enterprise license pricing to a base plus usage-metered model is projected to increase monthly recurring revenue by ₹14,50,000 across current enterprise accounts.'
    WHERE id = 'ins_01'
  `).run();
  db.prepare(`
    UPDATE insights 
    SET title = 'Proactive Churn Reduction Pipeline',
        desc = 'Predictive early warning alerts reduce mid-market customer churn by 22%.',
        full_content = 'By analyzing API call frequency dips across Day-14 to Day-30 cohorts, our telemetry flags at-risk enterprise accounts 3 weeks before renewal. Triggering automated CS check-ins protects ₹16,80,000 in annualized recurring contract value.'
    WHERE id = 'ins_02'
  `).run();
  db.prepare(`
    UPDATE insights 
    SET title = 'Compute & Cloud Infrastructure Optimization',
        desc = 'ARM cloud instances projected to trim recurring compute overhead.',
        full_content = 'Compute infrastructure expenses represent 38% of total operating overhead. Migrating backend processing pipelines to ARM/Graviton cloud instances reduces monthly AWS/GCP bills by ₹9,60,000 without degrading latency SLAs.'
    WHERE id = 'ins_03'
  `).run();
  db.prepare(`
    UPDATE insights 
    SET title = 'ARPU Acceleration via Enterprise Add-ons',
        desc = 'Dedicated compliance and SSO add-ons increase Average Revenue Per User.',
        full_content = 'Demand for SAML SSO and SOC-2 audit log exports has grown by 300%. Packaging these capabilities as high-tier add-on packs expands blended ARPU from ₹3,240 to ₹4,150 per subscription.'
    WHERE id = 'ins_04'
  `).run();

  // Seed retail records for secondary workspace if none exist
  const secRecCount = (db.prepare("SELECT COUNT(*) as count FROM timeseries_records WHERE workspace_id = ?").get(secondaryWsId) as any).count;
  if (secRecCount === 0) {
    const retailData = [
      { period: "2025-05", revenue: 10240000, expenses: 7840000, customers: 8400, churnRate: 3.9, industry: "Enterprise Software" },
      { period: "2025-06", revenue: 10800000, expenses: 8160000, customers: 8900, churnRate: 3.8, industry: "Enterprise Software" },
      { period: "2025-07", revenue: 11360000, expenses: 8480000, customers: 9500, churnRate: 3.7, industry: "Enterprise Software" },
      { period: "2025-08", revenue: 12080000, expenses: 8880000, customers: 10200, churnRate: 3.6, industry: "Enterprise Software" },
      { period: "2025-09", revenue: 13040000, expenses: 9520000, customers: 11000, churnRate: 3.5, industry: "Enterprise Software" },
      { period: "2025-10", revenue: 14240000, expenses: 10240000, customers: 12100, churnRate: 3.4, industry: "Enterprise Software" },
      { period: "2025-11", revenue: 16800000, expenses: 11840000, customers: 14200, churnRate: 3.2, industry: "Enterprise Software" },
      { period: "2025-12", revenue: 19600000, expenses: 13440000, customers: 16800, churnRate: 3.1, industry: "Enterprise Software" },
      { period: "2026-01", revenue: 14800000, expenses: 10800000, customers: 15200, churnRate: 3.3, industry: "Enterprise Software" },
      { period: "2026-02", revenue: 15360000, expenses: 11120000, customers: 15800, churnRate: 3.2, industry: "Enterprise Software" },
      { period: "2026-03", revenue: 16400000, expenses: 11680000, customers: 16900, churnRate: 3.0, industry: "Enterprise Software" },
      { period: "2026-04", revenue: 17440000, expenses: 12160000, customers: 18100, churnRate: 2.9, industry: "Enterprise Software" },
    ];

    const insertRetailRec = db.prepare(`
      INSERT INTO timeseries_records (id, user_id, workspace_id, period, revenue, expenses, customers, churn_rate, industry, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of retailData) {
      insertRetailRec.run(
        "ts_" + crypto.randomUUID(),
        demoUserId,
        secondaryWsId,
        r.period,
        r.revenue,
        r.expenses,
        r.customers,
        r.churnRate,
        r.industry,
        new Date().toISOString()
      );
    }

    // Seed 1 analysis report for Aether AI Platform
    const retailReport = {
      id: "rep_aether_01",
      userId: demoUserId,
      workspaceId: secondaryWsId,
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      industry: "Enterprise Software",
      summary: "Multi-product enterprise software telemetry demonstrates strong net expansion. Operating margin expanded to 30.3% following cloud infrastructure optimization. Churn rate stabilized at 2.9% across 18,100 active subscriptions.",
      riskLevel: "Low",
      efficiencyScore: 86,
      inputData: {
        revenue: 17440000,
        expenses: 12160000,
        customers: 18100,
        churnRate: 2.9,
        industry: "Enterprise Software",
        goals: "Scale enterprise APAC delivery channels and expand automated billing integrations",
      },
      prediction: {
        summary: "Multi-product enterprise software telemetry demonstrates strong net expansion. Operating margin expanded to 30.3% following cloud infrastructure optimization. Churn rate stabilized at 2.9% across 18,100 active subscriptions.",
        forecast: [
          { month: "Month 1", revenue: 18312000 },
          { month: "Month 2", revenue: 19227600 },
          { month: "Month 3", revenue: 20188900 },
          { month: "Month 4", revenue: 21198300 },
          { month: "Month 5", revenue: 22258200 },
          { month: "Month 6", revenue: 23371100 },
        ],
        recommendations: [
          "Deploy automated usage threshold alerts for enterprise tier account expansion.",
          "Formalize quarterly customer business reviews for Top 20 accounts.",
          "Negotiate multi-year cloud compute reservations to trim recurring infrastructure overhead.",
          "Introduce volume pricing incentives on additional developer API licenses.",
        ],
        riskLevel: "Low",
        efficiencyScore: 86,
      },
    };

    db.prepare(`
      INSERT INTO analysis_reports (
        id, user_id, workspace_id, timestamp, industry, summary, risk_level, efficiency_score, input_data_json, prediction_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      retailReport.id,
      retailReport.userId,
      retailReport.workspaceId,
      retailReport.timestamp,
      retailReport.industry,
      retailReport.summary,
      retailReport.riskLevel,
      retailReport.efficiencyScore,
      JSON.stringify(retailReport.inputData),
      JSON.stringify(retailReport.prediction)
    );

    // Seed 2 strategic insights for Aether Retail
    const retailInsights = [
      {
        id: "ins_aether_01",
        userId: demoUserId,
        workspaceId: secondaryWsId,
        title: "Combo Meal Basket Size Elasticity",
        desc: "Bundling beverage with daily thali/snacks yields 18% higher average order value.",
        fullContent: "Cross-merchandising telemetry highlights strong elasticity when bundling cold drinks or desserts with meal platters. Implementing combo pricing increases AOV from ₹180 to ₹235.",
        tag: "Product",
        image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2070",
        author: "Retail AI Strategist",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 91,
        date: "Oct 22, 2024",
        likes: 64,
        likedByUser: 0,
        savedByUser: 1,
        actionItems: [
          { id: "1", text: "Configure digital counter combo menu boards", done: true },
          { id: "2", text: "Track AOV impact across 1,000 checkout sessions", done: false },
        ],
      },
      {
        id: "ins_aether_02",
        userId: demoUserId,
        workspaceId: secondaryWsId,
        title: "Supply Chain & Perishables Optimization",
        desc: "Direct daily mandi sourcing reduces inventory spoilage cost by 14%.",
        fullContent: "Consolidating direct daily vegetable and dairy sourcing reduces delivery transit latency and eliminates middleman commission, driving operating margin up by 3.2%.",
        tag: "Operations",
        image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2070",
        author: "Supply Chain Engine",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 95,
        date: "Oct 19, 2024",
        likes: 82,
        likedByUser: 1,
        savedByUser: 0,
        actionItems: [
          { id: "1", text: "Route 35% of daily stock through direct distributor mandi channel", done: true },
          { id: "2", text: "Audit weekly wastage logs on fresh produce", done: false },
        ],
      },
    ];

    const insertSecInsight = db.prepare(`
      INSERT INTO insights (
        id, user_id, workspace_id, title, desc, full_content, tag, image, author, avatar,
        confidence, date, likes, liked_by_user, saved_by_user, action_items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ins of retailInsights) {
      insertSecInsight.run(
        ins.id,
        ins.userId,
        ins.workspaceId,
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

    // Seed copilot welcome message for Aether AI Platform
    db.prepare(`
      INSERT INTO chat_messages (id, user_id, workspace_id, role, content, metrics_snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "chat_init_aether_01",
      demoUserId,
      secondaryWsId,
      "assistant",
      "Hello Alex! Telemetry for Aether AI Platform is online. Monthly Recurring Revenue (MRR) is ₹1,74,40,000 across 18,100 active enterprise accounts with a 30.3% operating margin and 2.9% churn rate. How can I assist with your ACV projections, CAC payback analysis, or enterprise expansion models?",
      JSON.stringify({
        revenue: 17440000,
        expenses: 12160000,
        margin: 30.3,
        churn: 2.9,
        customers: 18100,
      }),
      new Date().toISOString()
    );

    console.log("🌱 Seeded secondary workspace telemetry, reports, insights & copilot briefing for Aether AI Platform.");
  }

  // Seed 12 months historical records if none exist for this user
  const recordCount = (db.prepare("SELECT COUNT(*) as count FROM timeseries_records WHERE user_id = ?").get(demoUserId) as any).count;
  if (recordCount === 0) {
    const historicalData = [
      { period: "2025-05", revenue: 3600000, expenses: 2720000, customers: 950, churnRate: 2.9, industry: "B2B SaaS" },
      { period: "2025-06", revenue: 3880000, expenses: 2816000, customers: 1020, churnRate: 2.7, industry: "B2B SaaS" },
      { period: "2025-07", revenue: 4160000, expenses: 2944000, customers: 1110, churnRate: 2.5, industry: "B2B SaaS" },
      { period: "2025-08", revenue: 4480000, expenses: 3080000, customers: 1220, churnRate: 2.4, industry: "B2B SaaS" },
      { period: "2025-09", revenue: 4920000, expenses: 3280000, customers: 1350, churnRate: 2.2, industry: "B2B SaaS" },
      { period: "2025-10", revenue: 5360000, expenses: 3456000, customers: 1490, churnRate: 2.1, industry: "B2B SaaS" },
      { period: "2025-11", revenue: 5800000, expenses: 3664000, customers: 1640, churnRate: 1.9, industry: "B2B SaaS" },
      { period: "2025-12", revenue: 6320000, expenses: 3840000, customers: 1800, churnRate: 1.9, industry: "B2B SaaS" },
      { period: "2026-01", revenue: 6760000, expenses: 4040000, customers: 1980, churnRate: 1.8, industry: "B2B SaaS" },
      { period: "2026-02", revenue: 7120000, expenses: 4160000, customers: 2120, churnRate: 1.7, industry: "B2B SaaS" },
      { period: "2026-03", revenue: 7560000, expenses: 4360000, customers: 2290, churnRate: 1.6, industry: "B2B SaaS" },
      { period: "2026-04", revenue: 7936000, expenses: 4496000, customers: 2450, churnRate: 1.5, industry: "B2B SaaS" },
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
      industry: "B2B SaaS",
      summary: "Financial trajectory demonstrates consistent top-line ARR acceleration with steady operating margin expansion. Customer acquisition velocity remains healthy while net monthly churn has stabilized at 1.5%. Unit economics strongly support aggressive expansion into high-tier enterprise cohorts.",
      riskLevel: "Low",
      efficiencyScore: 88,
      inputData: {
        revenue: 7936000,
        expenses: 4496000,
        customers: 2450,
        churnRate: 1.5,
        industry: "B2B SaaS",
        goals: "Scale to ₹1,20,00,000 MRR and accelerate enterprise ACV expansion"
      },
      prediction: {
        summary: "Financial trajectory demonstrates consistent top-line ARR acceleration with steady operating margin expansion. Customer acquisition velocity remains healthy while net monthly churn has stabilized at 1.5%. Unit economics strongly support aggressive expansion into high-tier enterprise cohorts.",
        forecast: [
          { month: "Month 1", revenue: 8452000 },
          { month: "Month 2", revenue: 9001600 },
          { month: "Month 3", revenue: 9586400 },
          { month: "Month 4", revenue: 10209600 },
          { month: "Month 5", revenue: 10873600 },
          { month: "Month 6", revenue: 11580000 },
        ],
        recommendations: [
          "Deploy automated usage-metering alerts to encourage mid-tier customer upgrades.",
          "Formalize quarterly customer business reviews for Top 20 enterprise accounts.",
          "Reinvest up to 15% of net operating surplus into verified B2B outbound sales pipelines.",
          "Migrate development and testing clusters to ARM architecture to curb cloud infrastructure overhead."
        ],
        riskLevel: "Low",
        efficiencyScore: 88
      }
    };

    const report2 = {
      id: "rep_demo_02",
      userId: demoUserId,
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      industry: "B2B SaaS",
      summary: "Healthy SaaS fundamentals with 42.3% operating margin. Customer retention improved 15 bps MoM. Recommended focus is reducing Day-30 onboarding friction to accelerate Net Dollar Retention.",
      riskLevel: "Low",
      efficiencyScore: 84,
      inputData: {
        revenue: 7120000,
        expenses: 4160000,
        customers: 2120,
        churnRate: 1.7,
        industry: "B2B SaaS",
        goals: "Surpass ₹80,00,000 MRR threshold"
      },
      prediction: {
        summary: "Healthy SaaS fundamentals with 42.3% operating margin. Customer retention improved 15 bps MoM. Recommended focus is reducing Day-30 onboarding friction to accelerate Net Dollar Retention.",
        forecast: [
          { month: "Month 1", revenue: 7582400 },
          { month: "Month 2", revenue: 8076000 },
          { month: "Month 3", revenue: 8600800 },
          { month: "Month 4", revenue: 9160000 },
          { month: "Month 5", revenue: 9755200 },
          { month: "Month 6", revenue: 10389600 },
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
        title: "Quick-Commerce Counter Defense",
        desc: "Hyperlocal 15-minute delivery for Kirana staples protects counter sales.",
        fullContent: "Our local footfall telemetry indicates that quick-commerce platforms are targeting household staple baskets. Offering WhatsApp-based 15-minute delivery within 1.5 km protects high-frequency kirana footfall and retains high-margin FMCG orders.",
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
          { id: "1", text: "Set up store WhatsApp business catalog with top 50 daily items", done: true },
          { id: "2", text: "Assign dedicated counter assistant for 15-minute delivery radius", done: false },
          { id: "3", text: "Distribute QR code pamphlets to nearby residential societies", done: false },
        ]
      },
      {
        id: "ins_02",
        userId: demoUserId,
        title: "Customer Drop-off Reduction",
        desc: "Automated SMS/WhatsApp promotional offers reduce monthly customer drop-off by 22%.",
        fullContent: "By analyzing counter ledger return rates across 30 days, we observed that customers not receiving monthly refill reminders drop off after 3 weeks. Implementing automated SMS reminder offers recovers ₹18,500 in repeat monthly GTV.",
        tag: "Operations",
        image: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=2070",
        author: "Alex Sterling",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 94,
        date: "Oct 22, 2024",
        likes: 256,
        likedByUser: 1,
        savedByUser: 1,
        actionItems: [
          { id: "1", text: "Configure automated 25-day grocery refill reminders", done: true },
          { id: "2", text: "Run festive weekend discount coupon on counter checkout", done: false },
          { id: "3", text: "Audit inactive customer ledger entries with store manager", done: true },
        ]
      },
      {
        id: "ins_03",
        userId: demoUserId,
        title: "Direct Mandi & Supply Efficiency",
        desc: "Direct mandi procurement projected to trim recurring supply overhead.",
        fullContent: "Procurement costs on staples and grains are running 7% above wholesale benchmarks. Transitioning bulk dal and rice procurement directly from agricultural mandi yards reduces procurement cost by ₹15,000/month.",
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
          { id: "1", text: "Establish direct mandi supply accounts for pulses and wheat", done: true },
          { id: "2", text: "Negotiate 30-day credit payment cycle with regional wholesale distributors", done: false },
        ]
      },
      {
        id: "ins_04",
        userId: demoUserId,
        title: "Average Order Value (AOV) Expansion",
        desc: "Checkout impulse displays increase basket size across walk-in footfall.",
        fullContent: "Transaction item density analysis indicates 68% of customers purchase single-category items. Placing high-margin impulse snacks and beverages near the UPI soundbox counter drives a 14% expansion in Average Order Value (AOV).",
        tag: "Finance",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=2070",
        author: "David Park",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80",
        confidence: 82,
        date: "Oct 18, 2024",
        likes: 167,
        likedByUser: 0,
        savedByUser: 0,
        actionItems: [
          { id: "1", text: "Install confectionery and beverage display rack next to UPI QR soundbox", done: false },
          { id: "2", text: "Bundle breakfast staples (bread + butter + eggs) at 5% combo incentive", done: false },
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
        text: "Monthly Recurring Revenue (MRR) reached ₹79,36,000 with an exceptional 43.3% operating margin.",
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
      content: "Hello Alex! I have loaded your 12-month financial telemetry. With your current MRR at ₹79,36,000/mo, operating margins at 43.3%, and customer churn at 1.5%, your business demonstrates exceptional capital efficiency (Rule of 40 score ~55%). How can I assist with your capital allocation, sensitivity models, or runway forecasts today?",
      metricsSnapshot: JSON.stringify({
        revenue: 7936000,
        expenses: 4496000,
        margin: 43.3,
        churn: 1.5,
        customers: 2450,
      }),
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    };

    db.prepare(`
      INSERT INTO chat_messages (id, user_id, workspace_id, role, content, metrics_snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(welcomeMsg.id, welcomeMsg.userId, defaultWsId, welcomeMsg.role, welcomeMsg.content, welcomeMsg.metricsSnapshot, welcomeMsg.createdAt);

    console.log("🌱 Seeded initial AI copilot message for demo user.");
  }
}

// ==========================================
// Workspace Management Helpers
// ==========================================
export interface WorkspaceRow {
  id: string;
  userId: string;
  name: string;
  industry: string;
  currency: string;
  createdAt: string;
}

export function getUserWorkspaces(userId: string): WorkspaceRow[] {
  const rows = db
    .prepare(
      "SELECT id, user_id as userId, name, industry, currency, created_at as createdAt FROM workspaces WHERE user_id = ? ORDER BY created_at ASC"
    )
    .all(userId) as any[];
  return rows;
}

export function getWorkspaceById(workspaceId: string, userId: string): WorkspaceRow | null {
  const row = db
    .prepare(
      "SELECT id, user_id as userId, name, industry, currency, created_at as createdAt FROM workspaces WHERE id = ? AND user_id = ?"
    )
    .get(workspaceId, userId) as any;
  return row || null;
}

export function createWorkspace(
  userId: string,
  name: string,
  industry: string,
  currency: string = "INR"
): WorkspaceRow {
  const id = "ws_" + crypto.randomUUID();
  const now = new Date().toISOString();
  const cur = (currency || "INR").trim().toUpperCase();

  db.prepare(`
    INSERT INTO workspaces (id, user_id, name, industry, currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, name.trim(), industry.trim(), cur, now);

  // Add creator as 'admin' in workspace_members
  db.prepare(`
    INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, ?, ?, 'admin', ?)
  `).run("wm_" + crypto.randomUUID(), id, userId, now);

  // Seed baseline starter records so metrics and charts render immediately
  const baseRevenue = 8000000;
  const baseExpenses = Math.round(baseRevenue * 0.56);
  const baseCustomers = 2450;
  const baseChurn = 1.5;

  const starterRows = [
    { period: "2026-02", revenue: Math.round(baseRevenue * 0.9), expenses: Math.round(baseExpenses * 0.92), customers: Math.round(baseCustomers * 0.9), churn: baseChurn + 0.3 },
    { period: "2026-03", revenue: Math.round(baseRevenue * 0.95), expenses: Math.round(baseExpenses * 0.96), customers: Math.round(baseCustomers * 0.95), churn: baseChurn + 0.1 },
    { period: "2026-04", revenue: baseRevenue, expenses: baseExpenses, customers: baseCustomers, churn: baseChurn },
  ];

  const insertRec = db.prepare(`
    INSERT INTO timeseries_records (id, user_id, workspace_id, period, revenue, expenses, customers, churn_rate, industry, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of starterRows) {
    insertRec.run("ts_" + crypto.randomUUID(), userId, id, r.period, r.revenue, r.expenses, r.customers, r.churn, industry, now);
  }

  // Seed initial welcome copilot briefing
  const margin = Number((((baseRevenue - baseExpenses) / baseRevenue) * 100).toFixed(1));
  const welcomeContent = `Hello! I have loaded telemetry for "${name.trim()}" (${industry.trim()}). Baseline MRR is ₹${baseRevenue.toLocaleString("en-IN")} with a ${margin}% operating margin and ${baseChurn}% churn across ${baseCustomers.toLocaleString("en-IN")} active subscriptions. How can I assist with your capital allocation, sensitivity models, or runway forecasts today?`;

  db.prepare(`
    INSERT INTO chat_messages (id, user_id, workspace_id, role, content, metrics_snapshot_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "chat_init_" + crypto.randomUUID(),
    userId,
    id,
    "assistant",
    welcomeContent,
    JSON.stringify({
      revenue: baseRevenue,
      expenses: baseExpenses,
      margin,
      churn: baseChurn,
      customers: baseCustomers,
    }),
    now
  );

  return {
    id,
    userId,
    name: name.trim(),
    industry: industry.trim(),
    currency: cur,
    createdAt: now,
  };
}

export function updateWorkspace(
  workspaceId: string,
  userId: string,
  data: { name?: string; industry?: string; currency?: string }
): WorkspaceRow | null {
  const existing = getWorkspaceById(workspaceId, userId);
  if (!existing) return null;

  const newName = data.name ? data.name.trim() : existing.name;
  const newIndustry = data.industry ? data.industry.trim() : existing.industry;
  const newCurrency = data.currency ? data.currency.trim().toUpperCase() : existing.currency;

  db.prepare(`
    UPDATE workspaces
    SET name = ?, industry = ?, currency = ?
    WHERE id = ? AND user_id = ?
  `).run(newName, newIndustry, newCurrency, workspaceId, userId);

  return {
    ...existing,
    name: newName,
    industry: newIndustry,
    currency: newCurrency,
  };
}

export function deleteWorkspace(workspaceId: string, userId: string) {
  const count = (
    db.prepare("SELECT COUNT(*) as count FROM workspaces WHERE user_id = ?").get(userId) as any
  ).count;
  if (count <= 1) {
    throw new Error("Cannot delete your only workspace. A minimum of one active workspace is required.");
  }

  db.prepare("DELETE FROM workspace_members WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM timeseries_records WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM analysis_reports WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM insights WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM chat_messages WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM workspaces WHERE id = ? AND user_id = ?").run(workspaceId, userId);
}

// ==========================================
// Workspace Member & Collaboration Helpers
// ==========================================
export interface WorkspaceMemberRow {
  id: string;
  workspaceId: string;
  userId: string;
  role: "admin" | "editor" | "viewer";
  joinedAt: string;
  name: string;
  email: string;
  avatar?: string;
  title?: string;
}

export function getWorkspaceMembers(workspaceId: string): WorkspaceMemberRow[] {
  const rows = db
    .prepare(`
      SELECT wm.id, wm.workspace_id as workspaceId, wm.user_id as userId, wm.role, wm.joined_at as joinedAt,
             COALESCE(u.name, 'Team Member') as name,
             COALESCE(u.email, 'member@workspace.com') as email,
             COALESCE(u.avatar, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80') as avatar,
             COALESCE(u.role, 'Financial Analyst') as title
      FROM workspace_members wm
      LEFT JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY 
        CASE wm.role 
          WHEN 'admin' THEN 1 
          WHEN 'editor' THEN 2 
          WHEN 'viewer' THEN 3 
          ELSE 4 
        END, wm.joined_at ASC
    `)
    .all(workspaceId) as any[];
  return rows;
}

export function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: "admin" | "editor" | "viewer" = "editor"
): string {
  const existing = db
    .prepare("SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .get(workspaceId, userId) as any;
  if (existing) {
    db.prepare("UPDATE workspace_members SET role = ? WHERE id = ?").run(role, existing.id);
    return existing.id;
  }

  const id = "wm_" + crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, workspaceId, userId, role, now);
  return id;
}
