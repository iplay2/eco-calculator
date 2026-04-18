// ============================================================
// ECN Calculator — Google Apps Script Middleware
// Receives calculator data, writes to Sheets + HubSpot
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

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Invalid JSON'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var results = {sheet: null, hubspot: null};

  // 1. Write to Google Sheet (existing behavior)
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

  return ContentService.createTextOutput(JSON.stringify({status: 'ok', results: results}))
    .setMimeType(ContentService.MimeType.JSON);
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

  // Set owner for new contacts only
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

  // Only fill empty fields — never overwrite existing data
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

  // Always tag as calculator source
  props.ecn_calculator_source = 'true';

  // Never overwrite owner — intentionally omitted

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
  var n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString();
}

function num(v) {
  if (v === undefined || v === null || v === '') return '—';
  return Number(v).toFixed(2);
}

// ============================================================
// Test function — run from Script Editor to verify
// ============================================================

function testPushToHubSpot() {
  var testData = {
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
    notes: 'Test record from calculator',
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

  var result = pushToHubSpot(testData);
  Logger.log(JSON.stringify(result, null, 2));
}
