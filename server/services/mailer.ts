import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let cachedTransporter: Transporter | null = null;
let isEtherealAccount = false;

/**
 * Initializes or retrieves a cached nodemailer Transporter.
 * If SMTP credentials are not present, creates an Ethereal test account.
 */
async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;

  // Use provided SMTP credentials if available
  if (host && user && pass && !host.startsWith('your_')) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
    isEtherealAccount = false;
    console.log(`✉️ Configured live SMTP transport via ${host}:${port} (${user})`);
    return cachedTransporter;
  }

  // Development Fallback: Ethereal Email test account
  console.log('📬 No SMTP credentials configured. Generating Ethereal test mail account for development simulation...');
  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  isEtherealAccount = true;
  console.log(`✅ Ethereal simulation account active: ${testAccount.user}`);
  return cachedTransporter;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  accepted?: string[];
  error?: string;
}

/**
 * Dispatches an automated executive weekly report email with attached vector PDF.
 */
export async function sendWeeklyReportEmail(
  toEmails: string[],
  workspaceName: string,
  pdfBuffer: Buffer
): Promise<EmailDispatchResult> {
  try {
    if (!toEmails || toEmails.length === 0) {
      throw new Error('No recipient email addresses provided.');
    }

    const transporter = await getTransporter();
    const fromAddress = process.env.SMTP_FROM || '"TrackWise Executive Telemetry" <reports@trackwise.io>';
    const sanitizedWorkspace = workspaceName.trim() || 'Kinetic SaaS Cloud';
    const filename = `${sanitizedWorkspace.replace(/[^a-zA-Z0-9_-]/g, '_')}_Weekly_Brief.pdf`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
            .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; padding: 32px 28px; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
            .header p { margin: 6px 0 0; color: #c7d2fe; font-size: 13px; font-weight: 500; }
            .content { padding: 28px; line-height: 1.6; }
            .kpi-grid { display: table; width: 100%; margin: 20px 0; border-collapse: separate; border-spacing: 10px; }
            .kpi-card { display: table-cell; width: 50%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
            .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
            .attachment-notice { margin-top: 16px; padding: 12px 16px; background: #eef2ff; border-radius: 8px; border: 1px solid #c7d2fe; color: #3730a3; font-size: 12px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <span class="badge" style="background: rgba(255,255,255,0.15); color: #ffffff; border-color: rgba(255,255,255,0.3); margin-bottom: 8px;">
                Weekly FP&A Executive Dispatch
              </span>
              <h1>${sanitizedWorkspace}</h1>
              <p>Automated Weekly Financial Brief & Strategic Forecasting</p>
            </div>

            <div class="content">
              <p style="font-size: 14px; margin-top: 0;">
                Hello Team,
              </p>
              <p style="font-size: 13px; color: #475569;">
                Your automated TrackWise executive brief for <strong>${sanitizedWorkspace}</strong> has been generated. This report aggregates the latest GAAP Profit & Loss statement, SaaS Unit Economics scorecards, and predictive 6-month ARR trajectories.
              </p>

              <div class="attachment-notice">
                📎 <strong>Attached:</strong> ${filename} (Multi-Page Server-Side Vector PDF Brief)
              </div>

              <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                Review the attached PDF document for full sensitivity tables, COGS breakdowns, and capital allocation recommendations. You can also view live real-time simulation models directly in the TrackWise dashboard.
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0;">
                Sent automatically by <strong>TrackWise FP&A Intelligence</strong> &bull; Scheduled every Monday at 8:00 AM.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmails.join(', '),
      subject: `[TrackWise Weekly Brief] ${sanitizedWorkspace} - Financial Telemetry & Forecast`,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('----------------------------------------------------');
      console.log('📧 Ethereal Email Preview URL (Open to view simulated email & PDF attachment):');
      console.log(`🔗 ${previewUrl}`);
      console.log('----------------------------------------------------');
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || false,
      accepted: info.accepted as string[],
    };
  } catch (err: any) {
    console.error('❌ Failed to dispatch weekly report email:', err);
    return {
      success: false,
      error: err.message || 'Unknown email dispatch error',
    };
  }
}
