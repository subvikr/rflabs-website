// Computes best-selling items by quantity (and total sale value) over a
// chosen date range, by fetching invoices in range then reading each one's
// line items (the Zoho invoice list endpoint doesn't include line items,
// only the per-invoice detail endpoint does). Read-only, nothing persisted.

const { getAccessToken, listInvoicesSince, getInvoiceLineItems } = require('./lib/zoho');

const MAX_INVOICES_PROCESSED = 250; // keeps this within a serverless function's time budget

function rangeToSinceDate(range) {
  const now = new Date();
  switch (range) {
    case 'last_30': {
      const d = new Date(now);
      d.setDate(now.getDate() - 30);
      return d;
    }
    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), qMonth, 1);
    }
    case 'this_year':
      return new Date(now.getFullYear(), 0, 1);
    case 'this_month':
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
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
    const range = (event.queryStringParameters && event.queryStringParameters.range) || 'this_month';
    const sinceDate = rangeToSinceDate(range);

    const accessToken = await getAccessToken();
    let invoices = await listInvoicesSince(accessToken, sinceDate);

    // Only count finalized sales — drafts and voided invoices aren't real sales.
    invoices = invoices.filter((inv) => !['draft', 'void'].includes(String(inv.status || '').toLowerCase()));

    const truncated = invoices.length > MAX_INVOICES_PROCESSED;
    const invoicesToProcess = invoices.slice(0, MAX_INVOICES_PROCESSED);

    const lineItems = await getInvoiceLineItems(
      accessToken,
      invoicesToProcess.map((inv) => inv.invoice_id)
    );

    const byItem = new Map();
    for (const li of lineItems) {
      const key = li.item_id || li.name;
      if (!key) continue;
      if (!byItem.has(key)) {
        byItem.set(key, { itemId: li.item_id, name: li.name, quantitySold: 0, totalAmount: 0 });
      }
      const entry = byItem.get(key);
      entry.quantitySold += Number(li.quantity || 0);
      entry.totalAmount += Number(li.item_total ?? li.total ?? (li.quantity || 0) * (li.rate || 0));
    }

    const items = Array.from(byItem.values()).sort((a, b) => b.quantitySold - a.quantitySold);

    return {
      statusCode: 200,
      body: JSON.stringify({
        items,
        invoicesProcessed: invoicesToProcess.length,
        totalInvoicesInRange: invoices.length,
        truncated,
        range,
        sinceDate: sinceDate.toISOString().slice(0, 10),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
