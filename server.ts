import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename);

// Validate required environment variables
const requiredEnvVars = ["GEMINI_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]); 

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(", ")}`);
  console.error("Please set all required environment variables before starting the server."); 
  process.exit(1);
}

let razorpay: Razorpay | null = null;
let genAI: GoogleGenAI | null = null;

function getRazorpay() {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay keys are not configured");
    }
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpay;
}

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Gemini AI Predictions endpoint
  app.post("/api/gemini/predict", async (req, res) => {
    try {
      const { revenue, expenses, customers, churnRate, industry, goals } = req.body;

      // Validate input
      if (!revenue || !expenses || !customers || churnRate === undefined || !industry || !goals) {
        return res.status(400).json({ error: "Missing required fields for prediction" });
      }

      const prompt = `
        Analyze this specific business profile and generate a data-driven predictive intelligence report.
        
        CRITICAL: Your response must be directly influenced by the specific values provided. 
        - If Churn Rate is high (>5%), focus heavily on retention strategies.
        - If Expenses are close to Revenue, focus on burn rate and runway.
        - If Revenue is high but churn is also high, identify the "leaky bucket" problem.
        - If Goals are aggressive, assess the feasibility based on current metrics.

        BUSINESS DATA:
        - Industry: ${industry}
        - Monthly Revenue: $${revenue}
        - Monthly Expenses: $${expenses}
        - Total Customers: ${customers}
        - Churn Rate: ${churnRate}%
        - Revenue per Customer (ARPU): $${(revenue / (customers || 1)).toFixed(2)}
        - Operating Margin: ${((revenue - expenses) / (revenue || 1) * 100).toFixed(1)}%
        - Business Goals: ${goals}
        
        YOUR REPORT MUST INCLUDE:
        1. SUMMARY: A 2-3 sentence expert assessment of their current financial health and market positioning.
        2. FORECAST: A 6-month projected revenue list. Calculate this logically: 
           New Revenue = Old Revenue * (1 + GrowthFactor - (ChurnRate/100)). 
           Assume a reasonable growth factor based on the industry and goals.
        3. RECOMMENDATIONS: 3-4 highly specific, actionable strategic steps.
        4. RISK LEVEL: "Low", "Medium", or "High" based on the margin and churn.
        5. EFFICIENCY SCORE: A number from 0-100 representing operational efficiency.
      `;

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are a world-class Business Intelligence Analyst. Provide precise, data-backed reports in JSON format.",
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
                    revenue: { type: Type.NUMBER }
                  },
                  required: ["month", "revenue"]
                }
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              riskLevel: {
                type: Type.STRING,
                enum: ["Low", "Medium", "High"]
              },
              efficiencyScore: { type: Type.NUMBER }
            },
            required: ["summary", "forecast", "recommendations", "riskLevel", "efficiencyScore"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini API");
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate prediction" });
    }
  });

  app.post("/api/razorpay/create-order", async (req, res) => {
    const { planId, interval } = req.body;

    // Map plan IDs to prices in INR (Razorpay usually uses INR)
    const prices: Record<string, number> = {
      'professional-monthly': 990000, // ₹9,900
      'professional-halfyearly': 5500000, // ₹55,000
      'professional-yearly': 9900000, // ₹99,000
      'enterprise-monthly': 2490000, // ₹24,900
      'enterprise-halfyearly': 12500000, // ₹125,000
      'enterprise-yearly': 22500000, // ₹225,000
    };

    const amount = prices[`${planId}-${interval}`];
    
    if (!amount) {
      return res.status(400).json({ error: "Invalid plan or interval" });
    }

    try {
      const razorpayClient = getRazorpay();
      const options = {
        amount: amount, // amount in the smallest currency unit
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpayClient.orders.create(options);
      res.json({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      });
    } catch (error: any) {
      console.error("Razorpay Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  // In production (Render sets NODE_ENV=production), serve from the built dist directory
  const isProduction = process.env.NODE_ENV === "production" || process.env.ENVIRONMENT === "production";
  
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve from the built dist directory
    const distPath = path.resolve(__dirname, "dist");
    
    // Check if dist folder exists, if not, this is an error
    if (!fs.existsSync(distPath)) {
      console.error("❌ ERROR: 'dist' folder not found at", distPath);
      console.error("Please make sure 'npm run build' completes successfully.");
      console.error("Current working directory:", __dirname);
      process.exit(1);
    }
    
    // Serve static files from dist with proper caching headers
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: false,
    }));
    
    // For any non-API, non-static routes, serve index.html (SPA routing)
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
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
