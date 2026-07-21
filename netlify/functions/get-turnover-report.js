// Builds the monthly turnover (sales) report: current month vs previous
// month, a rolling last-3-months total, and a 12-month trend for the chart.
// Read-only — never creates or modifies anything in Zoho.

const { getAccessToken, listInvoicesSince } = require('./lib/zoho');

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

exports.handler = async (event, context) => {
  // Require a logged-in RFLABS Identity user before doing anything else.
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const accessToken = await getAccessToken();

    const now = new Date();
    // 13 months back so "previous month" always has a slot, even right at
    // the start of a new month.
    const sinceDate = new Date(now.getFullYear(), now.getMonth() - 13, 1);
    const invoices = await listInvoicesSince(accessToken, sinceDate);

    const validInvoices = invoices.filter(
      (inv) => !['draft', 'void'].includes(String(inv.status || '').toLowerCase())
    );

    // Zero-filled scaffold for the last 13 calendar months (current + 12
    // prior) so lookups and the chart stay contiguous even if a month had
    // no invoices at all.
    const byMonth = new Map();
    const months = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const entry = { yearMonth: key, label: monthLabel(d), total: 0, invoiceCount: 0 };
      byMonth.set(key, entry);
      months.push(entry);
    }

    for (const inv of validInvoices) {
      if (!inv.date) continue;
      const entry = byMonth.get(monthKey(new Date(inv.date)));
      if (!entry) continue;
      entry.total += Number(inv.total ?? 0);
      entry.invoiceCount += 1;
    }

    const currentMonth = months[months.length - 1];
    const previousMonth = months[months.length - 2];

    const percentChange = previousMonth.total
      ? ((currentMonth.total - previousMonth.total) / previousMonth.total) * 100
      : null;

    const last3 = months.slice(-3);
    const last3Months = {
      label: `${last3[0].label} – ${last3[last3.length - 1].label}`,
      total: last3.reduce((sum, m) => sum + m.total, 0),
      invoiceCount: last3.reduce((sum, m) => sum + m.invoiceCount, 0),
    };

    // Excludes the current in-progress month — the chart shows the 12 most
    // recent *complete* months, ending with last month.
    const chartMonths = months.slice(0, -1);
    const grandTotal = months.reduce((sum, m) => sum + m.total, 0);

    return {
      statusCode: 200,
      body: JSON.stringify({
        currentMonth: {
          label: currentMonth.label,
          total: currentMonth.total,
          invoiceCount: currentMonth.invoiceCount,
        },
        previousMonth: { label: previousMonth.label, total: previousMonth.total },
        percentChange,
        last3Months,
        chartMonths,
        grandTotal,
        generatedAt: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
