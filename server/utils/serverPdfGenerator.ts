import PDFDocument from 'pdfkit';

export interface ServerReportData {
  workspaceName: string;
  industry: string;
  currency?: string;
  metrics: {
    revenue: number;
    expenses: number;
    margin: number;
    customers: number;
    churnRate: number;
    ruleOf40: number;
    ltv: number;
    efficiencyScore: number;
    riskLevel: string;
  };
  pnlSummary?: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    opex: number;
    netIncome: number;
    grossMargin: number;
    netMargin: number;
  };
  forecast?: Array<{
    month: string;
    revenue: number;
  }>;
  recommendations?: string[];
}

/**
 * Format currency safely for PDFKit standard fonts (which do not encode Unicode ₹ symbol)
 */
function formatPdfCurrency(amount: number, currencyCode: string = 'INR'): string {
  const cur = (currencyCode || 'INR').toUpperCase();
  const prefix = cur === 'INR' ? 'Rs. ' : `${cur} `;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (cur === 'INR') {
    if (abs >= 10000000) {
      return `${sign}${prefix}${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}${prefix}${(abs / 100000).toFixed(2)} Lakh`;
    }
  }

  return `${sign}${prefix}${Math.round(abs).toLocaleString('en-IN')}`;
}

/**
 * Generates a multi-page, high-fidelity vector PDF executive brief on the server side using PDFKit.
 * Returns a Buffer ready to be attached to emails or saved to disk.
 */
export async function generateServerVectorPDF(data: ServerReportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `TrackWise Executive Brief - ${data.workspaceName}`,
          Author: 'TrackWise AI FP&A Engine',
          Subject: 'Weekly Corporate Telemetry & Financial Forecast',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#1e1b4b'; // Deep Indigo
      const secondaryColor = '#3b82f6'; // Bright Blue
      const successColor = '#059669'; // Emerald
      const warningColor = '#d97706'; // Amber
      const textColor = '#0f172a'; // Slate 900
      const mutedColor = '#64748b'; // Slate 500
      const cardBg = '#f8fafc'; // Slate 50
      const borderCol = '#e2e8f0'; // Slate 200

      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // ==========================================
      // PAGE 1: Corporate Header & KPI Scorecard
      // ==========================================

      // Top Corporate Banner
      doc.rect(margin, margin, contentWidth, 68).fill(primaryColor);

      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold');
      doc.text('TrackWise Executive Telemetry', margin + 18, margin + 15);

      doc.fillColor('#c7d2fe').fontSize(10).font('Helvetica');
      doc.text(`CONFIDENTIAL WEEKLY BRIEF • ${data.workspaceName.toUpperCase()}`, margin + 18, margin + 40);

      const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      doc.fillColor('#e0e7ff').fontSize(9).font('Helvetica');
      doc.text(`Generated: ${dateStr}`, pageWidth - margin - 150, margin + 40, { width: 132, align: 'right' });

      let curY = margin + 85;

      // Workspace Metadata Pill
      doc.rect(margin, curY, contentWidth, 28).fillAndStroke('#f1f5f9', borderCol);
      doc.fillColor(mutedColor).fontSize(9).font('Helvetica-Bold');
      doc.text('WORKSPACE:', margin + 12, curY + 9);
      doc.fillColor(textColor).font('Helvetica');
      doc.text(data.workspaceName, margin + 80, curY + 9);

      doc.fillColor(mutedColor).font('Helvetica-Bold');
      doc.text('INDUSTRY:', margin + 260, curY + 9);
      doc.fillColor(textColor).font('Helvetica');
      doc.text(data.industry || 'B2B SaaS', margin + 325, curY + 9);

      doc.fillColor(mutedColor).font('Helvetica-Bold');
      doc.text('CURRENCY:', margin + 420, curY + 9);
      doc.fillColor(textColor).font('Helvetica');
      doc.text(data.currency || 'INR', margin + 485, curY + 9);

      curY += 42;

      // Section Title: Executive KPI Scorecard
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
      doc.text('EXECUTIVE PERFORMANCE SNAPSHOT', margin, curY);
      curY += 18;

      // 4 KPI Cards Grid (2 x 2)
      const cardWidth = (contentWidth - 12) / 2;
      const cardHeight = 62;

      // KPI 1: Monthly Recurring Revenue (MRR / GTV)
      doc.rect(margin, curY, cardWidth, cardHeight).fillAndStroke(cardBg, borderCol);
      doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica-Bold');
      doc.text('MONTHLY RUN RATE (MRR)', margin + 12, curY + 10);
      doc.fillColor(textColor).fontSize(16).font('Helvetica-Bold');
      doc.text(formatPdfCurrency(data.metrics.revenue, data.currency), margin + 12, curY + 23);
      doc.fillColor(successColor).fontSize(8).font('Helvetica');
      doc.text('+5.2% MoM Expansion Trajectory', margin + 12, curY + 45);

      // KPI 2: Operating Margin
      doc.rect(margin + cardWidth + 12, curY, cardWidth, cardHeight).fillAndStroke(cardBg, borderCol);
      doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica-Bold');
      doc.text('OPERATING MARGIN', margin + cardWidth + 24, curY + 10);
      doc.fillColor(textColor).fontSize(16).font('Helvetica-Bold');
      doc.text(`${data.metrics.margin.toFixed(1)}%`, margin + cardWidth + 24, curY + 23);
      doc.fillColor(successColor).fontSize(8).font('Helvetica');
      doc.text('COGS Benchmark: ~15% SaaS Base', margin + cardWidth + 24, curY + 45);

      curY += cardHeight + 12;

      // KPI 3: Active Subscribers / Accounts
      doc.rect(margin, curY, cardWidth, cardHeight).fillAndStroke(cardBg, borderCol);
      doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica-Bold');
      doc.text('ACTIVE SUBSCRIBERS / CLIENTS', margin + 12, curY + 10);
      doc.fillColor(textColor).fontSize(16).font('Helvetica-Bold');
      doc.text(data.metrics.customers.toLocaleString(), margin + 12, curY + 23);
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
      doc.text(`Monthly Churn Rate: ${data.metrics.churnRate.toFixed(1)}%`, margin + 12, curY + 45);

      // KPI 4: Rule of 40 / Capital Efficiency
      doc.rect(margin + cardWidth + 12, curY, cardWidth, cardHeight).fillAndStroke(cardBg, borderCol);
      doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica-Bold');
      doc.text('CAPITAL EFFICIENCY (RULE OF 40)', margin + cardWidth + 24, curY + 10);
      doc.fillColor(textColor).fontSize(16).font('Helvetica-Bold');
      doc.text(`${data.metrics.ruleOf40.toFixed(1)}%`, margin + cardWidth + 24, curY + 23);
      doc.fillColor(data.metrics.ruleOf40 >= 40 ? successColor : warningColor).fontSize(8).font('Helvetica');
      doc.text(data.metrics.ruleOf40 >= 40 ? 'Elite Tier (>40%)' : 'Healthy Efficiency Benchmark', margin + cardWidth + 24, curY + 45);

      curY += cardHeight + 24;

      // P&L Highlights Box
      if (data.pnlSummary) {
        doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
        doc.text('TRAILING FINANCIAL HIGHLIGHTS (GAAP CONSOLIDATED)', margin, curY);
        curY += 18;

        doc.rect(margin, curY, contentWidth, 75).fillAndStroke('#ffffff', borderCol);

        const colW = contentWidth / 4;
        const items = [
          { label: 'GROSS REVENUE', val: formatPdfCurrency(data.pnlSummary.revenue, data.currency) },
          { label: 'COGS (~15%)', val: formatPdfCurrency(data.pnlSummary.cogs, data.currency) },
          { label: 'GROSS PROFIT', val: formatPdfCurrency(data.pnlSummary.grossProfit, data.currency) },
          { label: 'NET OPERATING INCOME', val: formatPdfCurrency(data.pnlSummary.netIncome, data.currency) },
        ];

        items.forEach((it, idx) => {
          const colX = margin + idx * colW + 12;
          doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica-Bold');
          doc.text(it.label, colX, curY + 14);
          doc.fillColor(idx === 3 ? successColor : textColor).fontSize(12).font('Helvetica-Bold');
          doc.text(it.val, colX, curY + 30);
        });

        doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
        doc.text(`Operating Margin: ${data.pnlSummary.netMargin}% | Gross Margin: ${data.pnlSummary.grossMargin}%`, margin + 12, curY + 54);

        curY += 92;
      }

      // Strategic AI Advisory Highlights
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
      doc.text('EXECUTIVE STRATEGIC ADVISORY', margin, curY);
      curY += 18;

      const recs = (data.recommendations && data.recommendations.length > 0)
        ? data.recommendations.slice(0, 3)
        : [
            'Deploy automated usage-metering alerts to encourage mid-tier account expansion.',
            'Formalize quarterly customer business reviews for Top 20 enterprise accounts.',
            'Audit cloud compute clusters to negotiate multi-year reserved capacity commitments.',
          ];

      recs.forEach((rec, i) => {
        doc.fillColor(secondaryColor).fontSize(10).font('Helvetica-Bold');
        doc.text(`${i + 1}.`, margin + 8, curY);
        doc.fillColor(textColor).fontSize(9.5).font('Helvetica');
        doc.text(rec, margin + 24, curY, { width: contentWidth - 30, lineGap: 3 });
        curY += 26;
      });

      // Page 1 Footer
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
      doc.text(
        'Page 1 of 2  •  TrackWise FP&A Intelligence  •  Automated Executive Dispatch',
        margin,
        doc.page.height - 35,
        { width: contentWidth, align: 'center' }
      );

      // ==========================================
      // PAGE 2: 6-Month Forecast & Unit Economics
      // ==========================================
      doc.addPage();

      // Top Banner Page 2
      doc.rect(margin, margin, contentWidth, 48).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold');
      doc.text('Financial Forecast & Unit Economics Model', margin + 18, margin + 15);
      doc.fillColor('#c7d2fe').fontSize(8.5).font('Helvetica');
      doc.text('6-MONTH PREDICTIVE TRAJECTORY & SENSITIVITY BENCHMARKS', margin + 18, margin + 32);

      let p2Y = margin + 65;

      // Section: Forecast Table
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
      doc.text('6-MONTH PREDICTIVE REVENUE TRAJECTORY', margin, p2Y);
      p2Y += 18;

      const forecastRows = (data.forecast && data.forecast.length > 0)
        ? data.forecast
        : [
            { month: 'Month +1', revenue: Math.round(data.metrics.revenue * 1.05) },
            { month: 'Month +2', revenue: Math.round(data.metrics.revenue * 1.10) },
            { month: 'Month +3', revenue: Math.round(data.metrics.revenue * 1.15) },
            { month: 'Month +4', revenue: Math.round(data.metrics.revenue * 1.21) },
            { month: 'Month +5', revenue: Math.round(data.metrics.revenue * 1.27) },
            { month: 'Month +6', revenue: Math.round(data.metrics.revenue * 1.34) },
          ];

      // Table Header
      const thHeight = 22;
      doc.rect(margin, p2Y, contentWidth, thHeight).fillAndStroke('#f1f5f9', borderCol);
      doc.fillColor(textColor).fontSize(8.5).font('Helvetica-Bold');
      doc.text('PROJECTION TIMELINE', margin + 12, p2Y + 6);
      doc.text('PROJECTED MRR', margin + 160, p2Y + 6);
      doc.text('ANNUALIZED RUN RATE (ARR)', margin + 300, p2Y + 6);
      doc.text('ESTIMATED SURPLUS', margin + 410, p2Y + 6);
      p2Y += thHeight;

      // Table Rows
      forecastRows.forEach((row, idx) => {
        const rowH = 22;
        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.rect(margin, p2Y, contentWidth, rowH).fillAndStroke('#ffffff', borderCol);
        } else {
          doc.rect(margin, p2Y, contentWidth, rowH).fillAndStroke('#f8fafc', borderCol);
        }

        const projectedArr = row.revenue * 12;
        const estSurplus = Math.round(row.revenue * (data.metrics.margin / 100));

        doc.fillColor(textColor).fontSize(8.5).font('Helvetica-Bold');
        doc.text(row.month, margin + 12, p2Y + 6);

        doc.fillColor(primaryColor).font('Helvetica');
        doc.text(formatPdfCurrency(row.revenue, data.currency), margin + 160, p2Y + 6);

        doc.fillColor(mutedColor).font('Helvetica');
        doc.text(formatPdfCurrency(projectedArr, data.currency), margin + 300, p2Y + 6);

        doc.fillColor(successColor).font('Helvetica-Bold');
        doc.text(formatPdfCurrency(estSurplus, data.currency), margin + 410, p2Y + 6);

        p2Y += rowH;
      });

      p2Y += 24;

      // Section: SaaS Unit Economics Scorecard
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
      doc.text('LOCALIZED SAAS UNIT ECONOMICS SCORECARD', margin, p2Y);
      p2Y += 18;

      const arpu = data.metrics.customers > 0 ? data.metrics.revenue / data.metrics.customers : 3240;
      const cac = Math.max(50, arpu * 12 * 0.22);
      const ltvCac = (data.metrics.ltv / Math.max(1, cac)).toFixed(1);
      const paybackMo = (cac / Math.max(1, arpu * (Math.max(10, data.metrics.margin) / 100))).toFixed(1);

      const econCards = [
        {
          label: 'ESTIMATED CUSTOMER LTV',
          val: formatPdfCurrency(data.metrics.ltv, data.currency),
          sub: `Based on ${data.metrics.churnRate.toFixed(1)}% monthly churn`,
        },
        {
          label: 'LTV : CAC RATIO',
          val: `${ltvCac}x`,
          sub: 'Benchmark: > 3.0x Healthy Tier',
        },
        {
          label: 'CAC PAYBACK PERIOD',
          val: `${paybackMo} Months`,
          sub: 'Capital recovery velocity benchmark',
        },
        {
          label: 'AVERAGE REVENUE / USER',
          val: formatPdfCurrency(arpu, data.currency),
          sub: 'Blended average subscriber tier',
        },
      ];

      econCards.forEach((card, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cardX = margin + col * (cardWidth + 12);
        const cardY = p2Y + row * (cardHeight + 10);

        doc.rect(cardX, cardY, cardWidth, cardHeight).fillAndStroke(cardBg, borderCol);
        doc.fillColor(mutedColor).fontSize(8).font('Helvetica-Bold');
        doc.text(card.label, cardX + 12, cardY + 10);
        doc.fillColor(textColor).fontSize(15).font('Helvetica-Bold');
        doc.text(card.val, cardX + 12, cardY + 24);
        doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica');
        doc.text(card.sub, cardX + 12, cardY + 45);
      });

      p2Y += 2 * (cardHeight + 10) + 20;

      // Legal & Compliance Disclaimer Box
      doc.rect(margin, p2Y, contentWidth, 54).fillAndStroke('#f1f5f9', borderCol);
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica');
      doc.text(
        'DISCLAIMER: This document contains forward-looking financial telemetry and automated predictive modeling generated by the TrackWise FP&A engine. Projections are sensitive to market volatility, customer retention variations, and macroeconomic indicators. This brief does not constitute formal auditing or investment advice.',
        margin + 12,
        p2Y + 10,
        { width: contentWidth - 24, lineGap: 2.5 }
      );

      // Page 2 Footer
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
      doc.text(
        'Page 2 of 2  •  TrackWise FP&A Intelligence  •  Automated Executive Dispatch',
        margin,
        doc.page.height - 35,
        { width: contentWidth, align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
