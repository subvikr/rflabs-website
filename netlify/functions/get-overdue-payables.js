// Builds the overdue-bills-by-vendor (Outstanding Payables) summary.
// Read-only — never creates or modifies anything in Zoho. Nothing is
// persisted here; data is fetched fresh from Zoho on every call.

const { getAccessToken, listAllBills } = require('./lib/zoho');

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
    const bills = await listAllBills(accessToken);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // "Overdue" here means: has an unpaid balance AND the due date has passed —
    // this naturally includes partially-paid bills (only their remaining
    // balance counts), regardless of exactly how Zoho labels the status.
    const overdueBills = bills.filter((b) => {
      const balance = Number(b.balance ?? 0);
      if (balance <= 0.001) return false;
      if (['draft', 'void'].includes(String(b.status || '').toLowerCase())) return false;
      if (!b.due_date) return false;
      const dueDate = new Date(b.due_date);
      return dueDate < today;
    });

    const byVendor = new Map();
    for (const b of overdueBills) {
      const key = b.vendor_id || b.vendor_name;
      if (!byVendor.has(key)) {
        byVendor.set(key, {
          vendorId: b.vendor_id,
          vendorName: b.vendor_name,
          totalOverdue: 0,
          bills: [],
        });
      }
      const entry = byVendor.get(key);
      const balance = Number(b.balance ?? 0);
      entry.totalOverdue += balance;
      entry.bills.push({
        billId: b.bill_id,
        billNumber: b.bill_number,
        date: b.date,
        dueDate: b.due_date,
        total: Number(b.total ?? 0),
        balance,
        status: b.status,
        daysOverdue: Math.round((today - new Date(b.due_date)) / 86400000),
      });
    }

    const vendors = Array.from(byVendor.values())
      .map((v) => ({ ...v, bills: v.bills.sort((a, b) => b.daysOverdue - a.daysOverdue) }))
      .sort((a, b) => b.totalOverdue - a.totalOverdue);

    const grandTotal = vendors.reduce((sum, v) => sum + v.totalOverdue, 0);

    return {
      statusCode: 200,
      body: JSON.stringify({ vendors, grandTotal, generatedAt: new Date().toISOString() }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
