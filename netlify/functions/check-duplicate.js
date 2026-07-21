// Checks whether a bill that looks like this one may already exist in Zoho,
// so the review screen can warn the person before they confirm. Read-only —
// never creates or modifies anything. Nothing is persisted here either.

const { getAccessToken, findVendorByName, listBillsForVendor, findLikelyDuplicates } = require('./lib/zoho');

exports.handler = async (event, context) => {
  // Require a logged-in RFLABS Identity user before doing anything else.
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { vendor_name, invoice_number, invoice_date, total } = JSON.parse(event.body);
    if (!vendor_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'vendor_name is required' }) };
    }

    const accessToken = await getAccessToken();

    const vendorId = await findVendorByName(accessToken, vendor_name);
    if (!vendorId) {
      // Brand new vendor — nothing to compare against, so no possible duplicate.
      return { statusCode: 200, body: JSON.stringify({ duplicates: [] }) };
    }

    const existingBills = await listBillsForVendor(accessToken, vendorId);
    const duplicates = findLikelyDuplicates(existingBills, invoice_number, invoice_date, total);

    return { statusCode: 200, body: JSON.stringify({ duplicates }) };
  } catch (err) {
    // Duplicate-checking is a courtesy, not a hard requirement — fail quietly
    // rather than blocking the person from proceeding.
    return { statusCode: 200, body: JSON.stringify({ duplicates: [], checkFailed: true, error: err.message }) };
  }
};
