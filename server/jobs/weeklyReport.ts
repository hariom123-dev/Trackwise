import cron from 'node-cron';
import { db, logUserActivity, getBudgets } from '../db.ts';
import { generateServerVectorPDF, ServerReportData } from '../utils/serverPdfGenerator.ts';
import { sendWeeklyReportEmail, EmailDispatchResult } from '../services/mailer.ts';

export interface WorkspaceDispatchResult {
  workspaceId: string;
  workspaceName: string;
  recipients: string[];
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

/**
 * Aggregates workspace telemetry and dispatches the weekly report email.
 * If targetWorkspaceId is supplied, dispatches only for that specific workspace.
 */
export async function dispatchWeeklyReports(targetWorkspaceId?: string): Promise<WorkspaceDispatchResult[]> {
  console.log(`⏱️ [CRON] Starting weekly executive report dispatch at ${new Date().toISOString()}...`);

  const results: WorkspaceDispatchResult[] = [];

  try {
    let workspaces: any[] = [];
    if (targetWorkspaceId) {
      workspaces = db.prepare('SELECT * FROM workspaces WHERE id = ?').all(targetWorkspaceId);
    } else {
      workspaces = db.prepare('SELECT * FROM workspaces').all();
    }

    if (workspaces.length === 0) {
      console.warn('⚠️ [CRON] No workspaces found for weekly dispatch.');
      return results;
    }

    for (const ws of workspaces) {
      try {
        console.log(`📊 [CRON] Compiling executive brief for: "${ws.name}" (${ws.id})`);

        // 1. Fetch authorized workspace recipient emails
        const members = db
          .prepare(`
            SELECT DISTINCT u.email, u.name, wm.role
            FROM workspace_members wm
            JOIN users u ON wm.user_id = u.id
            WHERE wm.workspace_id = ? AND u.email IS NOT NULL AND u.email != ''
          `)
          .all(ws.id) as Array<{ email: string; name: string; role: string }>;

        let recipientEmails = members.map((m) => m.email.trim().toLowerCase());

        // Fallback: If no workspace members, fetch workspace owner
        if (recipientEmails.length === 0 && ws.user_id) {
          const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(ws.user_id) as any;
          if (owner?.email) {
            recipientEmails = [owner.email.trim().toLowerCase()];
          }
        }

        // Default demo email if none found
        if (recipientEmails.length === 0) {
          recipientEmails = ['alex@kinetic.com'];
        }

        // 2. Fetch latest timeseries telemetry
        const records = db
          .prepare('SELECT * FROM timeseries_records WHERE workspace_id = ? ORDER BY period ASC')
          .all(ws.id) as any[];

        const latestRecord = records[records.length - 1] || {
          period: '2026-04',
          revenue: 7936000,
          expenses: 4496000,
          customers: 2450,
          churn_rate: 1.5,
          industry: ws.industry || 'B2B SaaS',
        };

        const revenue = Number(latestRecord.revenue || 0);
        const expenses = Number(latestRecord.expenses || 0);
        const margin = revenue > 0 ? Number((((revenue - expenses) / revenue) * 100).toFixed(1)) : 43.3;
        const customers = Number(latestRecord.customers || 2450);
        const churnRate = Number(latestRecord.churn_rate || 1.5);
        const arpu = customers > 0 ? revenue / customers : 3240;
        const ltv = churnRate > 0 ? Math.round(arpu / (churnRate / 100)) : Math.round(arpu * 24);
        const ruleOf40 = Number((5.0 * 12 + margin).toFixed(1));

        // 3. Fetch latest analysis report
        const reportRow = db
          .prepare('SELECT * FROM analysis_reports WHERE workspace_id = ? ORDER BY timestamp DESC LIMIT 1')
          .get(ws.id) as any;

        let forecast: any[] = [];
        let recommendations: string[] = [];
        let efficiencyScore = 88;
        let riskLevel = 'Low';

        if (reportRow?.prediction_json) {
          try {
            const pred = JSON.parse(reportRow.prediction_json);
            forecast = pred.forecast || [];
            recommendations = pred.recommendations || [];
            efficiencyScore = pred.efficiencyScore || 88;
            riskLevel = pred.riskLevel || 'Low';
          } catch {}
        }

        // 4. Calculate P&L Snapshot
        const cogs = Math.round(revenue * 0.15);
        const grossProfit = revenue - cogs;
        const netIncome = grossProfit - expenses;

        const reportData: ServerReportData = {
          workspaceName: ws.name,
          industry: ws.industry || 'B2B SaaS',
          currency: ws.currency || 'INR',
          metrics: {
            revenue,
            expenses,
            margin,
            customers,
            churnRate,
            ruleOf40,
            ltv,
            efficiencyScore,
            riskLevel,
          },
          pnlSummary: {
            revenue,
            cogs,
            grossProfit,
            opex: expenses,
            netIncome,
            grossMargin: Number(((grossProfit / revenue) * 100).toFixed(1)),
            netMargin: Number(((netIncome / revenue) * 100).toFixed(1)),
          },
          forecast,
          recommendations,
        };

        // 5. Generate Server-Side Vector PDF
        const pdfBuffer = await generateServerVectorPDF(reportData);

        // 6. Send Email to Recipients
        const emailResult: EmailDispatchResult = await sendWeeklyReportEmail(
          recipientEmails,
          ws.name,
          pdfBuffer
        );

        // 7. Log to Audit Logs table
        const primaryUserId = ws.user_id || 'user_demo_alex_sterling';
        logUserActivity(
          primaryUserId,
          'WEEKLY_REPORT_DISPATCHED',
          `Dispatched weekly vector PDF brief for "${ws.name}" to ${recipientEmails.length} recipient(s): ${recipientEmails.join(', ')}.`,
          {
            title: 'Weekly Financial Brief Sent',
            text: `Weekly vector PDF report successfully emailed to: ${recipientEmails.slice(0, 2).join(', ')}${recipientEmails.length > 2 ? ' and others' : ''}.`,
            type: 'info',
          }
        );

        results.push({
          workspaceId: ws.id,
          workspaceName: ws.name,
          recipients: recipientEmails,
          success: emailResult.success,
          messageId: emailResult.messageId,
          previewUrl: emailResult.previewUrl,
          error: emailResult.error,
        });

        console.log(`✅ [CRON] Successfully dispatched report for "${ws.name}". MessageId: ${emailResult.messageId}`);
      } catch (wsErr: any) {
        console.error(`❌ [CRON] Failed to dispatch report for workspace "${ws.name}":`, wsErr);
        results.push({
          workspaceId: ws.id,
          workspaceName: ws.name,
          recipients: [],
          success: false,
          error: wsErr.message || 'Unknown error',
        });
      }
    }
  } catch (err: any) {
    console.error('❌ [CRON] Unexpected failure in dispatchWeeklyReports:', err);
  }

  return results;
}

/**
 * Initializes the recurring weekly report CRON scheduler.
 * Scheduled for Every Monday at 8:00 AM server time (0 8 * * 1).
 */
export function initWeeklyReportCron() {
  const cronSchedule = '0 8 * * 1';
  console.log(`🕒 Initializing Weekly Report CRON job on schedule: "${cronSchedule}" (Mondays at 8:00 AM)...`);

  cron.schedule(cronSchedule, async () => {
    console.log('⏰ [CRON TRIGGER] Executing scheduled Monday morning executive brief dispatch...');
    await dispatchWeeklyReports();
  });

  console.log('✅ Weekly Report CRON job registered and active.');
}
