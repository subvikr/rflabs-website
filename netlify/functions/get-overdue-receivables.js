// Builds the overdue-invoices-by-customer (Outstanding Receivables) summary.
// Read-only — never creates or modifies anything in Zoho. Nothing is
// persisted here; data is fetched fresh from Zoho on every call.

const { getAccessToken, listAllInvoices, ZOHO_API_DOMAIN, ZOHO_ORG_ID } = require('./lib/zoho');

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

    // Diagnostic: check the raw first-page response before assuming "no invoices"
    const diagUrl = `${ZOHO_API_DOMAIN}/inventory/v1/invoices?organization_id=${ZOHO_ORG_ID}&per_page=5`;
    const diagRes = await fetch(diagUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const diagJson = await diagRes.json();

    const invoices = await listAllInvoices(accessToken);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Same definition as payables: unpaid balance AND due date has passed.
    // Includes partially-paid invoices, counting only the remaining balance.
    const overdueInvoices = invoices.filter((inv) => {
      const balance = Number(inv.balance ?? 0);
      if (balance <= 0.001) return false;
      if (['draft', 'void'].includes(String(inv.status || '').toLowerCase())) return false;
      if (!inv.due_date) return false;
      const dueDate = new Date(inv.due_date);
      return dueDate < today;
    });

    const byCustomer = new Map();
    for (const inv of overdueInvoices) {
      const key = inv.customer_id || inv.customer_name;
      if (!byCustomer.has(key)) {
        byCustomer.set(key, {
          vendorId: inv.customer_id, // kept as vendorId/vendorName so the frontend can reuse one render function
          vendorName: inv.customer_name,
          totalOverdue: 0,
          bills: [],
        });
      }
      const entry = byCustomer.get(key);
      const balance = Number(inv.balance ?? 0);
      entry.totalOverdue += balance;
      entry.bills.push({
        billId: inv.invoice_id,
        billNumber: inv.invoice_number,
        date: inv.date,
        dueDate: inv.due_date,
        total: Number(inv.total ?? 0),
        balance,
        status: inv.status,
        daysOverdue: Math.round((today - new Date(inv.due_date)) / 86400000),
      });
    }

    const vendors = Array.from(byCustomer.values())
      .map((v) => ({ ...v, bills: v.bills.sort((a, b) => b.daysOverdue - a.daysOverdue) }))
      .sort((a, b) => b.totalOverdue - a.totalOverdue);

    const grandTotal = vendors.reduce((sum, v) => sum + v.totalOverdue, 0);

    return {
      statusCode: 200,
      body: JSON.stringify({
        vendors,
        grandTotal,
        generatedAt: new Date().toISOString(),
        diagnostic: { status: diagRes.status, sample: diagJson },
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
