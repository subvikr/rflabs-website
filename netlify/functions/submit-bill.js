// Receives the reviewed/edited invoice data + original file, and creates a
// DRAFT Bill in Zoho Inventory with the file attached. Nothing is persisted
// here — the file buffer and data live only in memory for this request.

const {
  getAccessToken,
  findOrCreateVendor,
  findItem,
  findTaxByPercentage,
  findDefaultExpenseAccount,
  createDraftBill,
  attachFileToBill,
  ZOHO_API_DOMAIN,
  ZOHO_ORG_ID,
} = require('./lib/zoho');

exports.handler = async (event, context) => {
  // Require a logged-in RFLABS Identity user before doing anything else.
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const warnings = [];

  try {
    const { data, fileBase64, fileName, mimeType } = JSON.parse(event.body);
    if (!data || !fileBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'data and fileBase64 are required' }) };
    }

    const accessToken = await getAccessToken();

    // 1. Vendor
    const vendorName = data.vendor_name?.trim() || 'Unknown Vendor';
    const { contactId: vendorId, created: vendorCreated } = await findOrCreateVendor(
      accessToken,
      vendorName,
      data.vendor_gstin
    );
    if (vendorCreated) warnings.push(`New vendor "${vendorName}" was created in Zoho.`);

    // 2. Tax — reuse whatever existing CGST+SGST tax matches the invoice's combined %
    const combinedGstPercent = Number(data.cgst_percent || 0) + Number(data.sgst_percent || 0);
    let taxId = null;
    if (combinedGstPercent > 0) {
      taxId = await findTaxByPercentage(accessToken, combinedGstPercent);
      if (!taxId) {
        warnings.push(
          `No existing Zoho tax rate matching ${combinedGstPercent}% was found — line items were submitted without tax applied. Set tax manually on the bill.`
        );
      }
    }

    // 3. Line items — match to existing Zoho items where possible
    let defaultAccountId = null; // fetched lazily, only if a free-text line is actually needed
    let accountLookupDone = false;
    const lineItems = [];
    for (const li of data.line_items || []) {
      const itemId = await findItem(accessToken, li.description, li.hsn_sac);
      const base = {
        quantity: Number(li.quantity) || 0,
        rate: Number(li.rate) || 0,
      };
      if (taxId) base.tax_id = taxId;

      if (itemId) {
        lineItems.push({ ...base, item_id: itemId });
      } else {
        if (!accountLookupDone) {
          accountLookupDone = true;
          const lookup = await findDefaultExpenseAccount(accessToken);
          if (lookup.accountId) {
            defaultAccountId = lookup.accountId;
            warnings.push(
              `Using "${lookup.accountName}" (via ${lookup.source} API) as the account for unmatched line items — verify this is right.`
            );
          } else {
            warnings.push(
              `Could not find any expense account automatically (source: ${lookup.source}). Raw responses: ${JSON.stringify(
                lookup.rawAttempts
              )}`
            );
          }
        }
        const freeTextLine = { ...base, name: li.description || 'Unmatched item' };
        if (defaultAccountId) freeTextLine.account_id = defaultAccountId;
        lineItems.push(freeTextLine);
        if (!warnings.some((w) => w.includes(li.description))) {
          warnings.push(`No matching Zoho item found for "${li.description}" — added as a free-text line.`);
        }
      }
    }

    // 4. Create the draft bill
    const billPayload = {
      vendor_id: vendorId,
      bill_number: data.invoice_number || '',
      date: data.invoice_date || new Date().toISOString().slice(0, 10),
      line_items: lineItems,
    };
    const bill = await createDraftBill(accessToken, billPayload);

    // 5. Attach the original file
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    await attachFileToBill(accessToken, bill.bill_id, fileBuffer, fileName || 'invoice.pdf', mimeType);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        billId: bill.bill_id,
        billUrl: `${ZOHO_API_DOMAIN.replace('www.zohoapis', 'inventory')}/app/${ZOHO_ORG_ID}#/bills/${bill.bill_id}`,
        warnings,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, diagnostics: warnings }) };
  }
};
