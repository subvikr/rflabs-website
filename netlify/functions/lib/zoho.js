// Shared helpers for talking to the Zoho Inventory API.
// Nothing here writes to disk — everything is request-scoped, in memory only.

const ZOHO_ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL; // e.g. https://accounts.zoho.in
const ZOHO_API_DOMAIN = process.env.ZOHO_API_DOMAIN; // e.g. https://www.zohoapis.in
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

function assertConfigured() {
  const missing = [
    'ZOHO_ACCOUNTS_URL',
    'ZOHO_API_DOMAIN',
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET',
    'ZOHO_REFRESH_TOKEN',
    'ZOHO_ORG_ID',
  ].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error('Missing environment variables: ' + missing.join(', '));
  }
}

async function getAccessToken() {
  assertConfigured();
  const url =
    `${ZOHO_ACCOUNTS_URL}/oauth/v2/token` +
    `?refresh_token=${encodeURIComponent(ZOHO_REFRESH_TOKEN)}` +
    `&client_id=${encodeURIComponent(ZOHO_CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(ZOHO_CLIENT_SECRET)}` +
    `&grant_type=refresh_token`;

  const res = await fetch(url, { method: 'POST' });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error('Zoho token refresh failed: ' + JSON.stringify(json));
  }
  return json.access_token;
}

function authHeaders(accessToken) {
  return { Authorization: `Zoho-oauthtoken ${accessToken}` };
}

async function findVendorByName(accessToken, vendorName) {
  const searchUrl =
    `${ZOHO_API_DOMAIN}/inventory/v1/contacts` +
    `?organization_id=${ZOHO_ORG_ID}` +
    `&contact_name_contains=${encodeURIComponent(vendorName)}`;

  const searchRes = await fetch(searchUrl, { headers: authHeaders(accessToken) });
  const searchJson = await searchRes.json();
  if (searchJson.contacts && searchJson.contacts.length > 0) {
    return searchJson.contacts[0].contact_id;
  }
  return null;
}

async function findOrCreateVendor(accessToken, vendorName, gstin) {
  const existingId = await findVendorByName(accessToken, vendorName);
  if (existingId) return { contactId: existingId, created: false };

  const createUrl = `${ZOHO_API_DOMAIN}/inventory/v1/contacts?organization_id=${ZOHO_ORG_ID}`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contact_name: vendorName,
      contact_type: 'vendor',
      gst_no: gstin || undefined,
    }),
  });
  const createJson = await createRes.json();
  if (!createJson.contact) {
    throw new Error('Failed to create vendor: ' + JSON.stringify(createJson));
  }
  return { contactId: createJson.contact.contact_id, created: true };
}

// Lists existing bills for a given vendor, used for duplicate checking before submission.
async function listBillsForVendor(accessToken, vendorId) {
  const url =
    `${ZOHO_API_DOMAIN}/inventory/v1/bills` +
    `?organization_id=${ZOHO_ORG_ID}&vendor_id=${vendorId}&per_page=200&sort_column=date&sort_order=D`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  const json = await res.json();
  return json.bills || [];
}

function normalizeBillNumber(billNumber) {
  return String(billNumber || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Compares a candidate bill against existing bills for the same vendor and
// flags likely duplicates by normalized bill number and/or close amount+date.
function findLikelyDuplicates(existingBills, candidateBillNumber, candidateDate, candidateTotal) {
  const normCandidate = normalizeBillNumber(candidateBillNumber);
  const candidateTime = candidateDate ? new Date(candidateDate).getTime() : null;

  return existingBills
    .filter((b) => {
      const normExisting = normalizeBillNumber(b.bill_number);
      const sameNumber = normCandidate && normExisting && normCandidate === normExisting;

      let closeAmountAndDate = false;
      if (candidateTotal && candidateTime && b.total != null && b.date) {
        const amountClose = Math.abs(Number(b.total) - Number(candidateTotal)) < 1;
        const daysApart = Math.abs(new Date(b.date).getTime() - candidateTime) / 86400000;
        closeAmountAndDate = amountClose && daysApart <= 3;
      }
      return sameNumber || closeAmountAndDate;
    })
    .map((b) => ({
      billId: b.bill_id,
      billNumber: b.bill_number,
      date: b.date,
      total: b.total,
      status: b.status,
    }));
}

async function findItem(accessToken, name, hsn) {
  const url =
    `${ZOHO_API_DOMAIN}/inventory/v1/items` +
    `?organization_id=${ZOHO_ORG_ID}` +
    `&name_contains=${encodeURIComponent(name)}`;

  const res = await fetch(url, { headers: authHeaders(accessToken) });
  const json = await res.json();

  if (json.items && json.items.length > 0) {
    // Prefer an exact HSN match if there are multiple partial name matches
    if (hsn) {
      const hsnMatch = json.items.find((i) => i.hsn_or_sac === hsn);
      if (hsnMatch) return hsnMatch.item_id;
    }
    return json.items[0].item_id;
  }
  return null;
}

// Finds an existing tax (or tax group) matching the given total percentage,
// e.g. 18 for CGST 9% + SGST 9%. Never creates a new tax rate.
async function findTaxByPercentage(accessToken, percentage) {
  const url = `${ZOHO_API_DOMAIN}/inventory/v1/settings/taxes?organization_id=${ZOHO_ORG_ID}`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  const json = await res.json();

  const taxes = json.taxes || [];
  // tax_specific_type / tax_percentage naming varies slightly by Zoho version,
  // so check a couple of plausible fields.
  const match = taxes.find((t) => {
    const pct = Number(t.tax_percentage ?? t.rate ?? 0);
    return Math.abs(pct - percentage) < 0.01;
  });
  return match ? match.tax_id : null;
}

// Zoho requires an account_id on any bill line item that isn't tied to an
// existing item_id (item-based lines inherit their account automatically).
// This finds a sensible default from the org's Chart of Accounts — never
// creates a new account.
// Zoho requires an account_id on any bill line item that isn't tied to an
// existing item_id (item-based lines inherit their account automatically).
// This finds a sensible default from the org's Chart of Accounts — never
// creates a new account. Tries the Inventory-scoped endpoint first (same
// API domain the Bills call itself uses), falling back to the Books-scoped
// one, since which one an org's accounts are visible through can vary.
async function listChartOfAccounts(accessToken) {
  const invUrl = `${ZOHO_API_DOMAIN}/inventory/v1/chartofaccounts?organization_id=${ZOHO_ORG_ID}&filter_by=AccountType.Active`;
  let res = await fetch(invUrl, { headers: authHeaders(accessToken) });
  let json = await res.json();
  if (json.chartofaccounts && json.chartofaccounts.length) {
    return { accounts: json.chartofaccounts, source: 'inventory' };
  }
  const invAttempt = { endpoint: 'inventory', status: res.status, body: json };

  const booksUrl = `${ZOHO_API_DOMAIN}/books/v3/chartofaccounts?organization_id=${ZOHO_ORG_ID}&filter_by=AccountType.Active`;
  res = await fetch(booksUrl, { headers: authHeaders(accessToken) });
  json = await res.json();
  if (json.chartofaccounts && json.chartofaccounts.length) {
    return { accounts: json.chartofaccounts, source: 'books' };
  }
  const booksAttempt = { endpoint: 'books', status: res.status, body: json };

  return { accounts: [], source: 'none', attempts: [invAttempt, booksAttempt] };
}

async function findDefaultExpenseAccount(accessToken) {
  const { accounts, source, attempts } = await listChartOfAccounts(accessToken);

  const pick = (predicate) => accounts.find(predicate);
  const cogs = pick((a) => /cost of goods sold/i.test(a.account_name));
  const purchase = pick((a) => /purchase/i.test(a.account_name));
  const expense = pick((a) => a.account_type === 'expense');
  const chosen = cogs || purchase || expense || null;

  return {
    accountId: chosen ? chosen.account_id : null,
    accountName: chosen ? chosen.account_name : null,
    source,
    sampleAccounts: accounts.slice(0, 8).map((a) => `${a.account_name} (${a.account_id})`),
    rawAttempts: attempts,
  };
}

// Fetches all bills for the org (paginated), used by the overdue dashboard.
// Capped at a handful of pages, which comfortably covers a small business's
// bill volume without risking a runaway loop.
async function listAllBills(accessToken, maxPages = 10) {
  const all = [];
  let page = 1;
  while (page <= maxPages) {
    const url =
      `${ZOHO_API_DOMAIN}/inventory/v1/bills` +
      `?organization_id=${ZOHO_ORG_ID}&per_page=200&page=${page}&sort_column=due_date&sort_order=A`;
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    const json = await res.json();
    const bills = json.bills || [];
    all.push(...bills);
    if (!json.page_context || !json.page_context.has_more_page) break;
    page += 1;
  }
  return all;
}

// Fetches all customer invoices for the org (paginated), used by the
// overdue receivables dashboard. Same pagination cap reasoning as bills.
async function listAllInvoices(accessToken, maxPages = 10) {
  const all = [];
  let page = 1;
  while (page <= maxPages) {
    const url =
      `${ZOHO_API_DOMAIN}/inventory/v1/invoices` +
      `?organization_id=${ZOHO_ORG_ID}&per_page=200&page=${page}&sort_column=due_date&sort_order=A`;
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    const json = await res.json();
    const invoices = json.invoices || [];
    all.push(...invoices);
    if (!json.page_context || !json.page_context.has_more_page) break;
    page += 1;
  }
  return all;
}

// Lists invoices sorted newest-first, stopping as soon as it passes the
// given cutoff date — much cheaper than fetching the whole history when we
// only need e.g. "this month".
async function listInvoicesSince(accessToken, sinceDate, maxPages = 10) {
  const result = [];
  let page = 1;
  while (page <= maxPages) {
    const url =
      `${ZOHO_API_DOMAIN}/inventory/v1/invoices` +
      `?organization_id=${ZOHO_ORG_ID}&per_page=200&page=${page}&sort_column=date&sort_order=D`;
    const res = await fetch(url, { headers: authHeaders(accessToken) });
    const json = await res.json();
    const invoices = json.invoices || [];

    let hitCutoff = false;
    for (const inv of invoices) {
      if (inv.date && new Date(inv.date) < sinceDate) {
        hitCutoff = true;
        break;
      }
      result.push(inv);
    }
    if (hitCutoff) break;
    if (!json.page_context || !json.page_context.has_more_page) break;
    page += 1;
  }
  return result;
}

// Fetches full invoice detail (including line_items) for a batch of invoice
// IDs, a handful at a time in parallel to stay within function time limits.
async function getInvoiceLineItems(accessToken, invoiceIds, concurrency = 8) {
  const results = [];
  for (let i = 0; i < invoiceIds.length; i += concurrency) {
    const batch = invoiceIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        const url = `${ZOHO_API_DOMAIN}/inventory/v1/invoices/${id}?organization_id=${ZOHO_ORG_ID}`;
        const res = await fetch(url, { headers: authHeaders(accessToken) });
        const json = await res.json();
        if (!json.invoice) return [];
        return (json.invoice.line_items || []).map((li) => ({ ...li, invoice_id: json.invoice.invoice_id }));
      })
    );
    results.push(...batchResults.flat());
  }
  return results;
}

async function createDraftBill(accessToken, payload) {
  const url = `${ZOHO_API_DOMAIN}/inventory/v1/bills?organization_id=${ZOHO_ORG_ID}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.bill) {
    throw new Error('Bill creation failed: ' + JSON.stringify(json));
  }
  return json.bill;
}

async function attachFileToBill(accessToken, billId, fileBuffer, fileName, mimeType) {
  const url =
    `${ZOHO_API_DOMAIN}/inventory/v1/bills/${billId}/attachment` +
    `?organization_id=${ZOHO_ORG_ID}`;

  const form = new FormData();
  form.append('attachment', new Blob([fileBuffer], { type: mimeType }), fileName);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(accessToken), // do NOT set Content-Type manually — fetch sets the multipart boundary
    body: form,
  });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error('Attachment upload failed: ' + JSON.stringify(json));
  }
  return json;
}

module.exports = {
  getAccessToken,
  findVendorByName,
  findOrCreateVendor,
  listBillsForVendor,
  listAllBills,
  listAllInvoices,
  listInvoicesSince,
  getInvoiceLineItems,
  findLikelyDuplicates,
  findItem,
  findTaxByPercentage,
  findDefaultExpenseAccount,
  createDraftBill,
  attachFileToBill,
  ZOHO_API_DOMAIN,
  ZOHO_ORG_ID,
};
