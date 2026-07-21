// Finds customers who used to order the 39201012 (stretch film) HSN code
// but haven't in over 30 days. Same fetch-invoices-then-fetch-line-items
// pattern as Top Items, grouped by customer the way Outstanding Payables
// groups by vendor. Read-only, nothing persisted.

const { getAccessToken, listInvoicesSince, getInvoiceLineItems } = require('./lib/zoho');

const HSN_CODE = '39201012';
const LAPSE_THRESHOLD_DAYS = 30;
const MAX_INVOICES_PROCESSED = 250; // keeps this within a serverless function's time budget

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sinceDate = new Date(today);
    sinceDate.setFullYear(sinceDate.getFullYear() - 1);

    const accessToken = await getAccessToken();
    let invoices = await listInvoicesSince(accessToken, sinceDate);

    // Only count finalized sales — drafts and voided invoices aren't real sales.
    invoices = invoices.filter((inv) => !['draft', 'void'].includes(String(inv.status || '').toLowerCase()));

    const invoicesToProcess = invoices.slice(0, MAX_INVOICES_PROCESSED);

    const lineItems = await getInvoiceLineItems(
      accessToken,
      invoicesToProcess.map((inv) => inv.invoice_id)
    );

    const qualifyingInvoiceIds = new Set();
    for (const li of lineItems) {
      if (li.hsn_or_sac === HSN_CODE) {
        qualifyingInvoiceIds.add(li.invoice_id);
      }
    }

    const byCustomer = new Map();
    for (const inv of invoicesToProcess) {
      if (!qualifyingInvoiceIds.has(inv.invoice_id)) continue;
      const key = inv.customer_id || inv.customer_name;
      if (!key) continue;

      const invDate = new Date(inv.date);
      const existing = byCustomer.get(key);
      if (!existing || invDate > existing.lastOrderDate) {
        byCustomer.set(key, {
          customerId: inv.customer_id,
          customerName: inv.customer_name,
          lastOrderDate: invDate,
        });
      }
    }

    const clients = Array.from(byCustomer.values())
      .map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        lastOrderDate: c.lastOrderDate.toISOString().slice(0, 10),
        daysSinceLastOrder: Math.round((today - c.lastOrderDate) / 86400000),
      }))
      .filter((c) => c.daysSinceLastOrder > LAPSE_THRESHOLD_DAYS)
      .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

    return {
      statusCode: 200,
      body: JSON.stringify({ clients, hsnCode: HSN_CODE, generatedAt: new Date().toISOString() }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
