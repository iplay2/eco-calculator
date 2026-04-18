// ============================================================
// ECN Calculator — Google Apps Script Middleware
// Receives calculator data, writes to Sheets + HubSpot
// Serves branded reports via doGet
// ============================================================

var CONFIG = {
  HUBSPOT_TOKEN: 'YOUR_HUBSPOT_TOKEN_HERE',
  DRY_RUN: false,
  HUBSPOT_API: 'https://api.hubapi.com'
};

// HubSpot owner IDs mapped to sales team names
// UPDATE these when switching from test to production portal
// Test portal (51362541) — only David exists as owner
// Production portal (47509333) — all team members have owner IDs
var OWNER_MAP = {
  'David Defelici': '80078321',
  'Clinton Roudenbush': '80078360',
  'Alfredo Munera': '75892982',
  'Jean Pierre Albrecht': '77497123',
  'Marcela Giraldo': '75886662',
  'Matthew Diersen': '88859290',
  'Carlos Roa': '1385731410'
};

// ============================================================
// doPost — receives calculator data
// ============================================================

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Invalid JSON'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var results = {sheet: null, hubspot: null, report: null};

  // 1. Write to Google Sheet
  try {
    results.sheet = writeToSheet(data);
  } catch (err) {
    results.sheet = {status: 'error', message: err.message};
  }

  // 2. Push to HubSpot
  try {
    results.hubspot = pushToHubSpot(data);
  } catch (err) {
    results.hubspot = {status: 'error', message: err.message};
  }

  // 3. Store report data and generate URL
  try {
    results.report = storeReport(data);
  } catch (err) {
    results.report = {status: 'error', message: err.message};
  }

  return ContentService.createTextOutput(JSON.stringify({status: 'ok', results: results}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// doGet — serves reports and tracks views
// ============================================================

function doGet(e) {
  var reportId = e.parameter.report;
  if (!reportId) {
    return HtmlService.createHtmlOutput('<h1>ECN Reports</h1><p>No report ID specified.</p>');
  }

  var data = loadReport(reportId);
  if (!data) {
    return HtmlService.createHtmlOutput('<h1>Report Not Found</h1><p>This report link may have expired or is invalid.</p>');
  }

  logReportView(reportId, e);

  var html = buildReportHtml(data);
  return HtmlService.createHtmlOutput(html)
    .setTitle((data.company_name || 'ECN') + ' — Revenue Opportunity Report')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// Report Storage
// ============================================================

function generateReportId() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var id = '';
  for (var i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function storeReport(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Reports');
  if (!sheet) {
    sheet = ss.insertSheet('Reports');
    sheet.getRange(1, 1, 1, 3).setValues([['report_id', 'created', 'data']]);
  }

  var reportId = generateReportId();
  var now = new Date().toISOString();
  sheet.appendRow([reportId, now, JSON.stringify(data)]);

  var url = ScriptApp.getService().getUrl() + '?report=' + reportId;
  return {status: 'ok', reportId: reportId, url: url};
}

function loadReport(reportId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Reports');
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === reportId) {
      try {
        return JSON.parse(data[i][2]);
      } catch (err) {
        return null;
      }
    }
  }
  return null;
}

function logReportView(reportId, e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ReportViews');
  if (!sheet) {
    sheet = ss.insertSheet('ReportViews');
    sheet.getRange(1, 1, 1, 3).setValues([['report_id', 'viewed_at', 'viewer_info']]);
  }

  var now = new Date().toISOString();
  var info = '';
  if (e && e.parameter) {
    info = JSON.stringify(e.parameter);
  }
  sheet.appendRow([reportId, now, info]);
}

// ============================================================
// Report HTML Generator
// ============================================================

function buildReportHtml(d) {
  var store = d.company_name || 'Your Store';
  var date = d.timestamp ? d.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10);
  var rep = d.sales_person || '';

  var fuelTx = n(d.daily_fuel_transactions);
  var instoreTx = n(d.daily_instore_transactions);
  var basket = n(d.basket_size);
  var fuelPrice = n(d.fuel_price);
  var traffic = n(d.daily_traffic);
  var gallons = n(d.gallons_per_fillup);
  var captureRate = d.baseline_capture_rate_pct || '—';
  var adtRate = d.adt_capture_rate_pct || '—';

  var ecnPumps = n(d.ecn_new_pumps);
  var ecnFuel = n(d.ecn_fuel_rev);
  var ecnInstore = n(d.ecn_instore_new_rev);
  var basketLiftRev = n(d.basket_lift_rev);
  var incDaily = n(d.incremental_daily);
  var incMonthly = n(d.incremental_monthly);
  var incAnnual = n(d.incremental_annual);
  var loyal = n(d.new_loyal_per_month);
  var ltv = n(d.ltv_monthly);
  var clv = n(d.customer_ltv);

  var zMonument = d.zone_monument === true || d.zone_monument === 'true';
  var zWindow = d.zone_window === true || d.zone_window === 'true';
  var zInstore = d.zone_instore === true || d.zone_instore === 'true';

  var zones = [];
  if (zMonument) zones.push('Monument Sign');
  if (zWindow) zones.push('Window Displays');
  if (zInstore) zones.push('In-Store Screens');

  // Build narrative paragraphs
  var narrative = [];
  if (zMonument && n(d.ecn_new_pumps) > 0) {
    narrative.push('Based on your location\'s average daily traffic of <strong>' + $(traffic) +
      ' vehicles</strong>, your ECN monument sign is projected to attract <strong>' + $(ecnPumps) +
      ' additional vehicles per day</strong> to your pumps. At <strong>' + $(gallons) +
      ' gallons per fill-up</strong> at <strong>$' + f2(fuelPrice) + '/gal</strong>, that translates to <strong>$' +
      $(ecnFuel) + ' in new daily fuel sales</strong>.');
  }
  if ((zWindow || zMonument) && n(d.ecn_instore_new_rev) > 0) {
    narrative.push('ECN window displays and signage convert more pump customers into store shoppers. ' +
      'With your current pump-to-store ratio and an average basket of <strong>$' + f2(basket) +
      '</strong>, this generates an estimated <strong>$' + $(ecnInstore) +
      ' per day</strong> in new in-store purchases.');
  }
  if (zInstore && n(d.basket_lift_rev) > 0) {
    narrative.push('In-store digital screens encourage impulse buys and highlight promotions, lifting your ' +
      'average basket by <strong>' + f2(d.basket_lift_pct) + '%</strong>. Across your <strong>' +
      $(instoreTx) + ' daily in-store transactions</strong>, that adds <strong>$' +
      $(basketLiftRev) + ' more per day</strong> from your existing customers.');
  }
  if (n(d.incremental_daily) > 0) {
    narrative.push('Combined, ECN digital signage adds an estimated <strong>$' + $(incDaily) +
      ' per day</strong> to your revenue — that\'s <strong>$' + $(incMonthly) +
      ' per month</strong> or <strong>$' + $(incAnnual) + ' per year</strong> in new revenue ' +
      'on top of what you\'re already doing.');
  }

  // Loyalty paragraph
  var loyaltyText = '';
  if (n(d.ecn_new_pumps) > 0) {
    loyaltyText = '<p>Beyond daily revenue, ECN signage builds long-term customer loyalty. Of the <strong>' +
      $(ecnPumps) + ' new daily visitors</strong>, an estimated <strong>5%</strong> will become loyal ' +
      'repeat customers — that\'s <strong>' + $(loyal) + ' new loyal customers every month</strong>.</p>' +
      '<p>At an estimated lifetime value of <strong>$' + $(clv) + ' per customer</strong>, that adds ' +
      '<strong>$' + $(ltv) + ' in long-term value every month</strong> to your business.</p>';
  }

  // Competition section
  var compText = '';
  if (d.client_corner && d.client_corner !== 'not set') {
    compText = '<div class="section"><h2>Competitive Position</h2>' +
      '<div class="comp-grid">' +
      '<div class="comp-item"><span class="comp-label">Your Corner</span><span class="comp-val">' + d.client_corner + '</span></div>' +
      '<div class="comp-item"><span class="comp-label">Market Structure</span><span class="comp-val">' + (d.market_structure || '—') + '</span></div>' +
      '<div class="comp-item"><span class="comp-label">Competitors</span><span class="comp-val">' + (d.competitor_count || 0) + '</span></div>' +
      '<div class="comp-item"><span class="comp-label">Combined Adjustment</span><span class="comp-val">' +
      (n(d.combined_multiplier) >= 1 ? '+' : '') + Math.round((n(d.combined_multiplier) - 1) * 100) + '%</span></div>' +
      '</div></div>';
  }

  // Bar chart data for CSS-based bars (no canvas needed)
  var barData = [];
  if (zMonument && n(d.ecn_fuel_rev) > 0) barData.push({label: 'New Fuel Sales', val: n(d.ecn_fuel_rev), color: '#2E86C1'});
  if ((zMonument || zWindow) && n(d.ecn_instore_new_rev) > 0) barData.push({label: 'New Store Visits', val: n(d.ecn_instore_new_rev), color: '#27AE60'});
  if (zInstore && n(d.basket_lift_rev) > 0) barData.push({label: 'Basket Lift', val: n(d.basket_lift_rev), color: '#F39C12'});

  var maxBar = 0;
  barData.forEach(function(b) { if (b.val > maxBar) maxBar = b.val; });

  var barsHtml = '';
  if (barData.length > 0) {
    barsHtml = '<div class="chart-section"><h3>Daily Revenue Lift by Source</h3><div class="bar-chart">';
    barData.forEach(function(b) {
      var pct = maxBar > 0 ? Math.round((b.val / maxBar) * 100) : 0;
      barsHtml += '<div class="bar-row">' +
        '<div class="bar-label">' + b.label + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + b.color + '"></div></div>' +
        '<div class="bar-val">$' + $(b.val) + '</div>' +
        '</div>';
    });
    barsHtml += '</div></div>';
  }

  // Notes section
  var notesHtml = '';
  if (d.notes && d.notes.trim()) {
    notesHtml = '<div class="section"><h2>Additional Notes</h2><p class="notes-text">' + escHtml(d.notes) + '</p></div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
    'body { font-family: system-ui, -apple-system, sans-serif; background: #f5f7fa; color: #1a1a2e; line-height: 1.6; }' +
    '.report { max-width: 800px; margin: 0 auto; background: #fff; }' +

    // Header
    '.header { background: linear-gradient(135deg, #042C53 0%, #0a4a8a 100%); color: #fff; padding: 3rem 2.5rem 2.5rem; }' +
    '.header-eyecatch { font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,.6); margin-bottom: .5rem; }' +
    '.header h1 { font-size: 28px; font-weight: 700; line-height: 1.2; margin-bottom: .25rem; }' +
    '.header-sub { font-size: 14px; color: rgba(255,255,255,.5); }' +

    // Hero KPI
    '.hero { background: #0F6E56; padding: 2rem 2.5rem; text-align: center; color: #fff; }' +
    '.hero-amount { font-size: 48px; font-weight: 800; letter-spacing: -1px; }' +
    '.hero-label { font-size: 16px; color: rgba(255,255,255,.7); margin-top: .25rem; }' +

    // Sections
    '.body { padding: 2rem 2.5rem; }' +
    '.section { margin-bottom: 2rem; }' +
    '.section h2 { font-size: 18px; font-weight: 700; color: #042C53; margin-bottom: 1rem; border-bottom: 2px solid #e8ecf1; padding-bottom: .5rem; }' +

    // KPI grid
    '.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }' +
    '.kpi-card { background: #f0f6ff; border-radius: 10px; padding: 1.25rem; text-align: center; }' +
    '.kpi-val { font-size: 24px; font-weight: 700; color: #042C53; }' +
    '.kpi-label { font-size: 12px; color: #666; margin-top: .25rem; }' +

    // Bar chart
    '.chart-section { margin-bottom: 2rem; }' +
    '.chart-section h3 { font-size: 14px; font-weight: 600; color: #666; margin-bottom: 1rem; }' +
    '.bar-chart { display: flex; flex-direction: column; gap: .75rem; }' +
    '.bar-row { display: flex; align-items: center; gap: .75rem; }' +
    '.bar-label { width: 120px; font-size: 13px; font-weight: 500; color: #333; text-align: right; flex-shrink: 0; }' +
    '.bar-track { flex: 1; height: 28px; background: #f0f0f0; border-radius: 6px; overflow: hidden; }' +
    '.bar-fill { height: 100%; border-radius: 6px; transition: width .3s; }' +
    '.bar-val { width: 80px; font-size: 14px; font-weight: 600; color: #333; }' +

    // Store profile table
    '.profile-table { width: 100%; border-collapse: collapse; }' +
    '.profile-table td { padding: .5rem .75rem; font-size: 14px; border-bottom: 1px solid #f0f0f0; }' +
    '.profile-table td:first-child { font-weight: 500; color: #666; width: 50%; }' +
    '.profile-table td:last-child { font-weight: 600; color: #1a1a2e; }' +

    // Narrative
    '.narrative p { margin-bottom: 1rem; font-size: 15px; color: #333; }' +
    '.narrative strong { color: #042C53; }' +

    // Competition
    '.comp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; }' +
    '.comp-item { background: #f8f9fb; border-radius: 8px; padding: 1rem; display: flex; justify-content: space-between; align-items: center; }' +
    '.comp-label { font-size: 13px; color: #666; }' +
    '.comp-val { font-size: 15px; font-weight: 600; color: #042C53; }' +

    // Zones
    '.zone-badges { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }' +
    '.zone-badge { background: #e8f4f0; color: #0F6E56; font-size: 12px; font-weight: 600; padding: .4rem .75rem; border-radius: 20px; }' +

    // Notes
    '.notes-text { font-size: 14px; color: #555; background: #fafafa; padding: 1rem; border-radius: 8px; border-left: 3px solid #042C53; }' +

    // Footer
    '.footer { background: #f8f9fb; padding: 1.5rem 2.5rem; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #e8ecf1; }' +
    '.footer a { color: #2E86C1; text-decoration: none; }' +

    // Print styles
    '@media print { body { background: #fff; } .report { box-shadow: none; } .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .kpi-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .bar-fill { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }' +

    // Responsive
    '@media (max-width: 600px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } .comp-grid { grid-template-columns: 1fr; } .header { padding: 2rem 1.5rem; } .body { padding: 1.5rem; } .hero-amount { font-size: 36px; } .bar-label { width: 90px; font-size: 12px; } }' +
    '</style></head><body>' +

    '<div class="report">' +

    // Header
    '<div class="header">' +
    '<div class="header-eyecatch">EyeCatch Networks</div>' +
    '<h1>' + escHtml(store) + '</h1>' +
    '<div class="header-sub">Revenue Opportunity Report &middot; ' + formatDate(date) + (rep ? ' &middot; Prepared by ' + escHtml(rep) : '') + '</div>' +
    '</div>' +

    // Hero
    '<div class="hero">' +
    '<div class="hero-amount">$' + $(n(d.incremental_annual)) + '</div>' +
    '<div class="hero-label">Estimated Additional Revenue Per Year</div>' +
    '</div>' +

    '<div class="body">' +

    // Active zones
    '<div class="zone-badges">' + zones.map(function(z) { return '<span class="zone-badge">' + z + '</span>'; }).join('') + '</div>' +

    // KPI grid
    '<div class="kpi-grid">' +
    '<div class="kpi-card"><div class="kpi-val">$' + $(incDaily) + '</div><div class="kpi-label">Daily Revenue Lift</div></div>' +
    '<div class="kpi-card"><div class="kpi-val">$' + $(incMonthly) + '</div><div class="kpi-label">Monthly Revenue Lift</div></div>' +
    '<div class="kpi-card"><div class="kpi-val">$' + $(incAnnual) + '</div><div class="kpi-label">Annual Revenue Lift</div></div>' +
    '<div class="kpi-card"><div class="kpi-val">' + $(ecnPumps) + '/day</div><div class="kpi-label">New Pump Visitors</div></div>' +
    '<div class="kpi-card"><div class="kpi-val">' + $(loyal) + '/mo</div><div class="kpi-label">New Loyal Customers</div></div>' +
    '<div class="kpi-card"><div class="kpi-val">$' + $(ltv) + '/mo</div><div class="kpi-label">Customer Lifetime Value</div></div>' +
    '</div>' +

    // Revenue breakdown chart
    barsHtml +

    // How ECN drives revenue
    '<div class="section"><h2>How ECN Drives Revenue for ' + escHtml(store) + '</h2>' +
    '<div class="narrative">' + narrative.map(function(p) { return '<p>' + p + '</p>'; }).join('') + '</div>' +
    '</div>' +

    // Loyalty
    (loyaltyText ? '<div class="section"><h2>Building Long-Term Customer Value</h2><div class="narrative">' + loyaltyText + '</div></div>' : '') +

    // Competition
    compText +

    // Store profile
    '<div class="section"><h2>Store Profile</h2>' +
    '<table class="profile-table">' +
    '<tr><td>Daily Road Traffic (AADT)</td><td>' + $(traffic) + ' vehicles</td></tr>' +
    '<tr><td>Daily Fuel Transactions</td><td>' + $(fuelTx) + '</td></tr>' +
    '<tr><td>Daily In-Store Transactions</td><td>' + $(instoreTx) + '</td></tr>' +
    '<tr><td>Average Basket Size</td><td>$' + f2(basket) + '</td></tr>' +
    '<tr><td>Fuel Price</td><td>$' + f2(fuelPrice) + '/gal</td></tr>' +
    '<tr><td>Gallons per Fill-Up</td><td>' + f2(gallons) + '</td></tr>' +
    '<tr><td>Baseline Capture Rate</td><td>' + captureRate + '%</td></tr>' +
    '<tr><td>ECN Capture Rate</td><td>' + adtRate + '%</td></tr>' +
    '</table></div>' +

    // Notes
    notesHtml +

    '</div>' +

    // Footer
    '<div class="footer">' +
    '<p>Prepared by EyeCatch Networks &middot; eyecatch.co</p>' +
    '<p style="margin-top:.25rem">Estimates based on industry averages from NACS, ITE, and EIA data. Actual results may vary.</p>' +
    '</div>' +

    '</div></body></html>';
}

// ============================================================
// Google Sheets
// ============================================================

function writeToSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leads') || ss.getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (headers[0] === '') {
    headers = Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
  sheet.appendRow(row);
  return {status: 'ok', row: sheet.getLastRow()};
}

// ============================================================
// HubSpot Integration
// ============================================================

function pushToHubSpot(data) {
  if (!data.email || data.email.trim() === '') {
    return {status: 'skipped', message: 'No email provided'};
  }

  var existing = searchContact(data.email);
  var contactId;
  var isNew = false;

  if (existing) {
    contactId = existing.id;
    updateContact(contactId, data, existing.properties);
  } else {
    contactId = createContact(data);
    isNew = true;
  }

  var noteId = attachNote(contactId, data);

  return {
    status: 'ok',
    contactId: contactId,
    isNew: isNew,
    noteId: noteId
  };
}

function searchContact(email) {
  var payload = {
    filterGroups: [{
      filters: [{
        propertyName: 'email',
        operator: 'EQ',
        value: email.trim().toLowerCase()
      }]
    }],
    properties: ['email', 'firstname', 'lastname', 'company', 'phone',
                 'address', 'city', 'state', 'zip', 'hubspot_owner_id',
                 'ecn_calculator_source']
  };

  var resp = hubspotRequest('POST', '/crm/v3/objects/contacts/search', payload);
  if (resp.total > 0) {
    return resp.results[0];
  }
  return null;
}

function createContact(data) {
  var props = {
    email: data.email.trim().toLowerCase(),
    firstname: data.first_name || '',
    lastname: data.last_name || '',
    company: data.company_name || '',
    phone: data.phone || '',
    address: data.street || '',
    city: data.city || '',
    state: data.state || '',
    zip: data.zip || '',
    ecn_calculator_source: 'true'
  };

  var ownerId = OWNER_MAP[data.sales_person];
  if (ownerId) {
    props.hubspot_owner_id = ownerId;
  }

  if (CONFIG.DRY_RUN) {
    Logger.log('DRY RUN — would create contact: ' + JSON.stringify(props));
    return 'dry-run-id';
  }

  var resp = hubspotRequest('POST', '/crm/v3/objects/contacts', {properties: props});
  return resp.id;
}

function updateContact(contactId, data, existingProps) {
  var props = {};

  var fieldMap = {
    firstname: data.first_name,
    lastname: data.last_name,
    company: data.company_name,
    phone: data.phone,
    address: data.street,
    city: data.city,
    state: data.state,
    zip: data.zip
  };

  for (var prop in fieldMap) {
    var newVal = fieldMap[prop] || '';
    var existingVal = existingProps[prop] || '';
    if (newVal && !existingVal) {
      props[prop] = newVal;
    }
  }

  props.ecn_calculator_source = 'true';

  if (CONFIG.DRY_RUN) {
    Logger.log('DRY RUN — would update contact ' + contactId + ': ' + JSON.stringify(props));
    return;
  }

  if (Object.keys(props).length > 0) {
    hubspotRequest('PATCH', '/crm/v3/objects/contacts/' + contactId, {properties: props});
  }
}

function attachNote(contactId, data) {
  var m = data;
  var body = '**ECN Calculator Report — ' + (m.company_name || 'Unknown') + '**\n' +
    'Date: ' + m.timestamp + '\n' +
    'Sales Rep: ' + (m.sales_person || 'N/A') + '\n\n' +
    '**Store Profile**\n' +
    '• Daily Traffic (AADT): ' + fmt(m.daily_traffic) + '\n' +
    '• Daily Fuel Transactions: ' + fmt(m.daily_fuel_transactions) + '\n' +
    '• Daily In-Store Transactions: ' + fmt(m.daily_instore_transactions) + '\n' +
    '• Avg Basket Size: $' + num(m.basket_size) + '\n' +
    '• Fuel Price: $' + num(m.fuel_price) + '/gal\n' +
    '• Baseline Capture Rate: ' + m.baseline_capture_rate_pct + '%\n\n' +
    '**ECN Impact (Daily)**\n' +
    '• ADT Capture Rate: ' + m.adt_capture_rate_pct + '%\n' +
    '• New Pump Visits: +' + fmt(m.ecn_new_pumps) + '/day\n' +
    '• Zones: Monument=' + m.zone_monument + ' Window=' + m.zone_window + ' In-Store=' + m.zone_instore + '\n' +
    '• Fuel Revenue Lift: $' + fmt(m.ecn_fuel_rev) + '\n' +
    '• New Store Visit Revenue: $' + fmt(m.ecn_instore_new_rev) + '\n' +
    '• Basket Lift Revenue: $' + fmt(m.basket_lift_rev) + '\n\n' +
    '**Revenue Summary**\n' +
    '• Incremental Daily: $' + fmt(m.incremental_daily) + '\n' +
    '• Incremental Monthly: $' + fmt(m.incremental_monthly) + '\n' +
    '• Incremental Annual: $' + fmt(m.incremental_annual) + '\n' +
    '• New Loyal Customers/Month: ' + fmt(m.new_loyal_per_month) + '\n' +
    '• LTV Monthly Value: $' + fmt(m.ltv_monthly) + '\n\n' +
    '**Competition**\n' +
    '• Client Corner: ' + m.client_corner + '\n' +
    '• Market Structure: ' + m.market_structure + '\n' +
    '• Combined Multiplier: ' + num(m.combined_multiplier) + 'x';

  if (m.notes) {
    body += '\n\n**Notes:** ' + m.notes;
  }

  if (CONFIG.DRY_RUN) {
    Logger.log('DRY RUN — would attach note to ' + contactId + ':\n' + body);
    return 'dry-run-note';
  }

  var resp = hubspotRequest('POST', '/crm/v3/objects/notes', {
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_note_body: body
    },
    associations: [{
      to: {id: contactId},
      types: [{
        associationCategory: 'HUBSPOT_DEFINED',
        associationTypeId: 202
      }]
    }]
  });

  return resp.id;
}

// ============================================================
// HubSpot API Helper
// ============================================================

function hubspotRequest(method, path, payload) {
  var options = {
    method: method.toLowerCase(),
    headers: {
      'Authorization': 'Bearer ' + CONFIG.HUBSPOT_TOKEN,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  var resp = UrlFetchApp.fetch(CONFIG.HUBSPOT_API + path, options);
  var code = resp.getResponseCode();
  var body = resp.getContentText();

  if (code >= 400) {
    throw new Error('HubSpot API error ' + code + ': ' + body);
  }

  return body ? JSON.parse(body) : {};
}

// ============================================================
// Formatting helpers
// ============================================================

function fmt(v) {
  if (v === undefined || v === null || v === '') return '—';
  var nn = Number(v);
  return isNaN(nn) ? String(v) : nn.toLocaleString();
}

function num(v) {
  if (v === undefined || v === null || v === '') return '—';
  return Number(v).toFixed(2);
}

function n(v) {
  if (v === undefined || v === null || v === '') return 0;
  var nn = Number(v);
  return isNaN(nn) ? 0 : nn;
}

function $(v) {
  if (typeof v === 'number') return v.toLocaleString('en-US');
  var nn = Number(v);
  return isNaN(nn) ? String(v) : nn.toLocaleString('en-US');
}

function f2(v) {
  var nn = Number(v);
  return isNaN(nn) ? '—' : nn.toFixed(2);
}

function formatDate(d) {
  try {
    var parts = d.split('-');
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  } catch (e) {
    return d;
  }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// Test functions
// ============================================================

function testPushToHubSpot() {
  var testData = getTestData();
  var result = pushToHubSpot(testData);
  Logger.log(JSON.stringify(result, null, 2));
}

function testReportHtml() {
  var testData = getTestData();
  var html = buildReportHtml(testData);
  Logger.log(html.substring(0, 500) + '...');
  Logger.log('Report HTML length: ' + html.length + ' chars');
}

function testStoreAndLoadReport() {
  var testData = getTestData();
  var result = storeReport(testData);
  Logger.log('Stored report: ' + JSON.stringify(result));

  var loaded = loadReport(result.reportId);
  Logger.log('Loaded report company: ' + loaded.company_name);
}

function getTestData() {
  return {
    timestamp: new Date().toISOString().slice(0,19),
    sales_person: 'David Defelici',
    company_name: 'Test Fuel Stop',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane.doe@testfuelstop.dev',
    phone: '555-123-4567',
    street: '100 Main St',
    city: 'Miami',
    state: 'FL',
    zip: '33157',
    notes: 'Great corner location with high visibility. Owner interested in monument sign.',
    daily_traffic: 10000,
    fuel_price: 3.31,
    daily_fuel_transactions: 400,
    daily_instore_transactions: 560,
    basket_size: 7.80,
    baseline_capture_rate_pct: '4.00',
    client_corner: 'SE',
    homeward_direction: 'S',
    competitor_count: 2,
    market_structure: 'Triopoly',
    corner_multiplier: 1.15,
    competition_multiplier: 0.92,
    combined_multiplier: 1.06,
    monument_lift_pct: 2.5,
    gallons_per_fillup: 8.3,
    window_boost_pct: 3.5,
    basket_lift_pct: 4.1,
    customer_ltv: 225,
    zone_monument: true,
    zone_window: true,
    zone_instore: true,
    adt_capture_rate_pct: '0.190',
    ecn_new_pumps: 19,
    base_fuel_rev: 10968,
    ecn_fuel_rev: 522,
    ecn_instore_new_rev: 186,
    basket_lift_rev: 179,
    incremental_daily: 887,
    incremental_monthly: 26610,
    incremental_annual: 323755,
    baseline_daily_total: 15336,
    ecn_daily_total: 16223,
    new_loyal_per_month: 29,
    ltv_monthly: 6525,
    sync_status: 'queued'
  };
}
