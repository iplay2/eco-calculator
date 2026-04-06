# ECN Convenience Store Revenue Potential
## Application Specification for Claude Code

---

## 1. Project overview

Build a single-page web application (HTML + CSS + vanilla JavaScript, no frameworks required) for **EyeCatch Networks (ECN)** sales representatives to use in the field on tablets and smartphones. The app calculates the incremental revenue potential a convenience store operator could expect by deploying ECN's managed digital signage services. It is a **sales presentation tool**, not a back-end application — all logic runs client-side with no server or database required.

**Output:** A single `index.html` file (self-contained, all CSS and JS inline).

---

## 2. Design system

### Color palette
| Role | Hex |
|---|---|
| Page background | `#0C447C` |
| Header / tab bar background | `#042C53` |
| Card background | `rgba(255,255,255,0.10)` |
| Card border | `rgba(255,255,255,0.15)` |
| Primary text | `#ffffff` |
| Secondary text | `rgba(255,255,255,0.60)` |
| Muted text | `rgba(255,255,255,0.40)` |
| Accent blue | `#85B7EB` |
| Accent teal (positive) | `#9FE1CB` |
| Accent green (hero positive) | `#0F6E56` |
| Accent amber (avg markers) | `#FFD580` |
| Accent red (errors) | `#F09595` |
| Active tab underline | `#85B7EB` |

### Typography
- Font: `system-ui, -apple-system, sans-serif`
- All text white or white with opacity
- Heading sizes: 20px (app title), 16px (section), 14px (slider labels), 13px (body/notes), 11px (caps labels), 10px (badges)
- Font weights: 400 (body), 500 (labels), 600 (headings/buttons), 700–800 (hero numbers)

### Touch targets
- All buttons minimum 48px tall, full-width where possible
- Input fields: 22px bold text, 14px padding
- Slider thumbs: 32px × 32px circle, `border: 3px solid #185FA5`
- Slider track: 8px tall, `border-radius: 4px`

### Cards
- `background: rgba(255,255,255,0.10)`
- `border: 1px solid rgba(255,255,255,0.15)`
- `border-radius: 14px`
- `padding: 1.1rem 1rem`
- `margin-bottom: 1rem`

### Buttons
- Primary: white background, `#0C447C` text, bold, `border-radius: 12px`, 16px padding
- Secondary: transparent, white border `rgba(255,255,255,0.40)`, white text

---

## 3. Application structure

Six tabs in a horizontally-scrollable tab bar at the top:

| # | Tab label |
|---|---|
| 1 | 1 · Store info |
| 2 | 2 · Competition |
| 3 | 3 · ECN impact |
| 4 | 4 · Display zones |
| 5 | 5 · Summary |
| 6 | References |

Active tab indicated by white text + `#85B7EB` 3px bottom border. All other tabs are `rgba(255,255,255,0.55)`. Tab bar scrolls horizontally on small screens (`overflow-x: auto`, no scrollbar).

---

## 4. Tab 1 — Store info

### Section A: Prospect contact
Optional section. Rule: if any field is filled, all fields must be filled. Partially-filled state highlights empty fields with `#F09595` red border and shows a warning message: *"All contact fields must be filled out together, or leave all blank."*

Fields (all `type="text"` unless noted, large input style):
- **Company name** — updates the subtitle line in the app header in real time
- **First name** / **Last name** — side by side in a 2-column grid
- **Email** — `type="email"`
- **Phone** — `type="tel"`
- **Street address**
- **City** / **State** — side by side; State `maxlength="2"`
- **Zip code** — `maxlength="10"`

### Section B: Property
Fields:
- **Daily road traffic** — number input, default `10000`. Label: *"Vehicles/day passing the property"*. Note: *"From state DOT AADT data"*
- **Fuel price ($/gal)** — number input, step `0.05`, default `3.31`. Note: *"EIA 2024 avg $3.31/gal"*

### Section C: Ask the prospect
Fields:
- **Daily fuel transactions** — number input, default `320`. Note: *"Median ~320/day · NACS avg ~480/day"*. Shows a live derived badge: **Baseline capture rate** = `(fillups / traffic × 100).toFixed(2) + '%'`
- **Daily in-store transactions** — number input, default `560`. Note: *"Median ~560/day · NACS avg ~1,100/day"*. Shows live derived badge: **Store/pump ratio** = `(basefoot / fillups).toFixed(2) + 'x'`
- **Avg in-store basket size ($)** — number input, step `0.10`, default `7.80`. Note: *"NACS 2023 avg $7.80"*

Nav: "Next: Competition →" primary button (right-aligned).

---

## 5. Tab 2 — Competition

### Intersection diagram
A `3×3 CSS grid` representing a four-way intersection:

```
[NW corner] [N road segment] [NE corner]
[W road]    [center block]   [E road]
[SW corner] [S road segment] [SE corner]
```

**Corner buttons** (4 total — NW, NE, SW, SE):
- Default state: dashed border, semi-transparent background, label shows corner name + "Tap to set" + "empty" badge
- **Client state** (blue): solid `#85B7EB` border, light blue background, shows "This C-store" + "client" badge
- **Competitor state** (red): solid `#F09595` border, light red background, shows "Competitor" + "competitor" badge

**Interaction logic (two-step):**
1. First tap sets the **client corner** (one only). Step hint updates to Step 2.
2. Subsequent taps on other corners toggle **competitor** on/off.
3. Tapping the client corner again clears it and resets to Step 1.

**Road segments:** Semi-transparent fill, subtle border. N/S segments show direction label centered. W/E segments show direction label on their inner edge.

### Homeward bound direction
6-button grid (None, Northbound, Southbound, Eastbound, Westbound — None active by default). Active state: `#85B7EB` border, light blue background.

**Right-turn-in logic** — which corners have the best access for each homeward direction:
```
Northbound  → best: SE, NE  | fair: SW  | poor: NW
Southbound  → best: SW, NW  | fair: NE  | poor: SE
Eastbound   → best: SW, SE  | fair: NE  | poor: NW
Westbound   → best: NE, NW  | fair: SW  | poor: SE
None        → best: all four corners (no adjustment)
```

### Competitive position analysis
Auto-renders below once client corner is set. Shows three cards:

**Card 1 — Corner access:**
- Client corner label + colored rating badge
- Access vs. homeward flow description
- Access multiplier: Best = +20%, Fair = +5%, Challenging = −15%

**Card 2 — Market structure:**
- Number of competitors on other corners
- Market structure label:
  - 0 competitors → "Monopoly — no direct competitors" → +15%
  - 1 competitor → "Duopoly — one direct competitor" → 0%
  - 2 competitors → "Triopoly — coordination instability" → −8%
  - 3 competitors → "Four-corner — maximum competition" → −15%
- Competition multiplier

**Card 3 — Combined adjustment:**
- Combined multiplier = corner mult × competition mult
- Large number display (green if positive, amber if neutral, red if negative)
- Note: *"Applied to monument sign traffic capture."*
- Background color changes to match direction (green/amber/red tint)

Nav: ← Back | Next: ECN impact → buttons.

---

## 6. Tab 3 — ECN impact

Intro line: *"All sliders start below industry average. The ▲ mark shows the average. Slide up to show full potential."*

Four cards, each with one or two sliders. Each slider has:
- A header row: label (with data quality badge) on left, current value large on right
- A range input with 32px custom thumb
- An amber `▲` tick mark positioned at the industry average value
- A source note below

**Slider specifications:**

| Slider | Min | Max | Step | Default (½ avg) | Industry avg | Badge |
|---|---|---|---|---|---|---|
| Monument sign capture lift | 0.5% | 8% | 0.1 | 1.3% | 2.5% | `est` |
| Gallons per fill-up | 6 | 16 | 0.5 | 8.3 | 10.5 | `solid` |
| Window display pump→store boost | 1% | 20% | 0.5 | 3.5% | 7% | `est` |
| In-store screens basket lift | 3% | 40% | 0.5 | 4.1% | 8.1% | `solid` |
| Customer LTV | $50 | $2,000 | $10 | $225 | $450 | `est` |

**Avg marker positioning formula:**
```javascript
pct = (avgVal - min) / (max - min)
thumbWidth = 32
markerLeft = thumbWidth/2 + pct * (trackWidth - thumbWidth)
```
Reposition on window resize.

**Live derived badge** below Monument sign slider: *"ECN adds [X] new pump visits/day"* where X = `round(traffic × monument% / 100)`.

Card groupings:
- Card 1: Monument sign + Gallons per fill-up
- Card 2: Window displays
- Card 3: In-store screens basket lift
- Card 4: Customer lifetime value

Nav: ← Back | Next: Display zones → buttons.

---

## 7. Tab 4 — Display zones

Three toggle buttons in a 3-column grid (all active by default):

| Zone | Description | Impact label |
|---|---|---|
| Monument sign | LED roadside | Street → pump |
| Window displays | Daylight LED | Pump → store |
| In-store screens | Menu, cooler, cashier | Basket lift |

Tap to toggle active/inactive. Active = `#85B7EB` border, light blue background. Inactive zones are excluded from revenue calculations.

Nav: ← Back | View summary → buttons.

---

## 8. Tab 5 — Summary

### Period selector
Three-button row: Daily / Monthly / Annual. Active = `#85B7EB` border, light blue fill. Multipliers: daily=1, monthly=30, annual=365.

### Hero card
Full-width card. When `ecnTotal > 0`: green background (`#0F6E56`), teal border. When zero/negative: dark navy (`#042C53`), blue border.
- Small label: *"Incremental revenue opportunity with ECN"*
- Large value: formatted dollar amount
- Sub-label: period (e.g. "per year")

### Competition adjustment banner
Shown only when competition tab has been configured and multiplier ≠ 1.0. Amber background, amber border. Text: *"Competition adjustment: [boosted/reduced] by X% — [corner description]. [market structure label]."*

### Before / After comparison
Two-column card grid:
- **Without ECN** (dark card): fuel/day, in-store/day, daily fuel revenue, daily in-store revenue, daily total
- **With ECN** (blue-tinted card): same fields with ECN-adjusted values

### Revenue delta table
Four rows: Fuel revenue | In-store revenue (new visits) | Basket lift (signage) | Total daily (bold, tinted row). Columns: Source | Before | After | Delta (green).

### Zone contribution
List of active zones with colored dot, zone name, lift percentage, and period-adjusted revenue contribution.

### Customer lifetime value card
Green-tinted card:
- New pump visitors/day
- Est. new loyal customers/month (5% conversion rate)
- LTV per loyal customer
- **LTV added per month** (total = loyal/month × clv)

Nav: ← Back button.

---

## 9. Revenue model (JavaScript)

```javascript
// Inputs from V object:
// V.traffic, V.fuelprice, V.fillups, V.basefoot, V.basket
// V.monument, V.window, V.lift, V.clv, V.gallons

// Competition multiplier
var cornerMult  // 1.20 best / 1.05 fair / 0.85 poor (or 1.0 if no corner set)
var compMult    // 1.15 monopoly / 1.0 duopoly / 0.92 triopoly / 0.85 four-corner
var cm = cornerMult * compMult  // combined, applied to monument traffic only

// Baseline (before ECN)
baseFuelRev    = fillups × gallons × fuelprice
baseInstoreRev = basefoot × basket
baseTotalDay   = baseFuelRev + baseInstoreRev

// ECN-driven new pump visits (monument sign, adjusted for competition/corner)
ecnPumps = (monument active ? traffic × (monument/100) : 0) × cm

// Pump-to-store conversion
baseP2S   = min(basefoot / fillups, 0.95)   // actual ratio from prospect data
windowBoost = window active ? window/100 : 0
ecnInstore = ecnPumps × min(baseP2S + windowBoost, 0.95)

// Revenue from ECN
ecnFuelRev    = ecnPumps × gallons × fuelprice
ecnInstoreNew = ecnInstore × basket
basketLift    = (instore active ? basefoot × basket × (lift/100) : 0)
ecnTotal      = ecnFuelRev + ecnInstoreNew + basketLift

// After-ECN totals
afterFuelRev    = baseFuelRev + ecnFuelRev
afterInstoreRev = baseInstoreRev + ecnInstoreNew + basketLift
afterTotal      = afterFuelRev + afterInstoreRev

// Customer LTV
newLoyalPerMonth = ecnPumps × 30 × 0.05
clvMonthly       = newLoyalPerMonth × clv

// Apply period multiplier (1 / 30 / 365) to all revenue outputs for display
```

---

## 10. Tab 6 — References

Static content. Two badge types: `solid` (green tint) and `estimated` (amber tint).

Five sections with source cards:
1. **Industry benchmarks** — NACS SOI 2023, NACS/NIQ 2024, CSNews 2024–25, MMCG 2023, Statista/CSNews 2022
2. **Fuel & traffic data** — API/EIA 2022, LookUpAPlate 2025, MMCG Analytics
3. **Digital signage effectiveness** — Journal of Marketing 2025, AIScreen/SeenLabs 2025, Samsung 2025
4. **Customer lifetime value** — Paytronix 2023, NIQ/NACS 2024
5. **Competitive economics** — Hotelling 1929, Maskin & Tirole 1988/Noel 2007, Dallas Fed 2025, Assad et al. 2024, Site selection practice, Penneco Outdoor/OAAA

Footer note: *"Green = peer-reviewed / major trade association. Amber = industry estimate or self-reported survey."*

---

## 11. Key data defaults

| Field | Default | Source |
|---|---|---|
| Daily traffic | 10,000 | Typical suburban arterial |
| Fuel price | $3.31/gal | EIA 2024 national avg |
| Daily fuel transactions | 320 | MMCG median P&L |
| Daily in-store transactions | 560 | MMCG median P&L |
| Basket size | $7.80 | NACS 2023 |
| Monument lift | 1.3% | Half of 2.5% industry avg |
| Gallons/fill-up | 8.3 | Below avg (slider midpoint) |
| Window boost | 3.5% | Half of 7% industry avg |
| Basket lift | 4.1% | Half of 8.1% peer-reviewed avg |
| LTV | $225 | Half of $450 industry avg |

---

## 12. Technical requirements

- **Single file:** `index.html` — all CSS in `<style>`, all JS in `<script>` at bottom of body
- **No external dependencies** — no npm, no CDN libraries, no frameworks
- **Vanilla JavaScript only** — use `var` declarations for maximum compatibility
- **Mobile-first:** `<meta name="viewport" content="width=device-width,initial-scale=1">`
- **Touch-optimized:** `-webkit-tap-highlight-color: transparent`, large tap targets throughout
- **No server required:** Open directly in a browser or serve as a static file

### Browser compatibility
Target: iOS Safari 14+, Chrome for Android, modern desktop browsers.

### File structure
```
ecn-calculator/
└── index.html       (single self-contained file)
```

---

## 14. Data logging — Google Sheets sync with offline queue

### Architecture overview

```
Submit pressed
    │
    ├─ navigator.onLine = true ──► POST to Google Apps Script ──► Row appended to Sheet ──► "Saved ✓"
    │
    └─ navigator.onLine = false ─► Save to localStorage queue ──► "Saved offline — will sync"
                                          │
                                   window.addEventListener('online')
                                          │
                                   Auto-retry all queued records ──► Sheet updated
                                          │
                                   Clear queue ──► "X records synced ✓"

Always available: "Download CSV" button exports all localStorage records as a local file
```

### When to show the Save button

The **Save record** button appears on the Summary tab (Tab 5) only when all prospect contact fields are filled and valid (company name, first name, last name, email, phone, street, city, state, zip). If contact fields are incomplete, show a disabled button with tooltip: *"Complete prospect contact info on Tab 1 to save."*

### Data fields saved per record

Every saved record includes the following columns in this order:

| Column | Value |
|---|---|
| timestamp | ISO 8601 datetime, e.g. `2026-04-05T14:32:00` |
| company_name | from f_storename |
| first_name | from f_fname |
| last_name | from f_lname |
| email | from f_email |
| phone | from f_phone |
| street | from f_street |
| city | from f_city |
| state | from f_state |
| zip | from f_zip |
| daily_traffic | V.traffic |
| fuel_price | V.fuelprice |
| daily_fuel_transactions | V.fillups |
| daily_instore_transactions | V.basefoot |
| basket_size | V.basket |
| baseline_capture_rate_pct | (fillups/traffic×100).toFixed(2) |
| client_corner | clientCorner or "not set" |
| homeward_direction | homeDir |
| competitor_count | count of competitor corners |
| market_structure | e.g. "Duopoly" |
| corner_multiplier | e.g. 1.20 |
| competition_multiplier | e.g. 1.00 |
| combined_multiplier | corner × competition |
| monument_lift_pct | V.monument |
| gallons_per_fillup | V.gallons |
| window_boost_pct | V.window |
| basket_lift_pct | V.lift |
| customer_ltv | V.clv |
| zone_monument | true/false |
| zone_window | true/false |
| zone_instore | true/false |
| incremental_daily | model().ecnTotal (rounded) |
| incremental_monthly | model().ecnTotal × 30 (rounded) |
| incremental_annual | model().ecnTotal × 365 (rounded) |
| baseline_daily_total | model().baseTotalDay (rounded) |
| ecn_daily_total | model().afterTotal (rounded) |
| new_loyal_per_month | model().newLoyalPerMonth (rounded) |
| ltv_monthly | model().clvMonthly (rounded) |
| sync_status | "synced" or "queued" |

### JavaScript implementation

```javascript
var APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_DEPLOYMENT_URL_HERE';
var STORAGE_KEY = 'ecn_submission_queue';

function buildRecord() {
  var m = model();
  var comp = getCompInfo();
  var pos = clientCorner ? getCornerRating(clientCorner, homeDir) : {mult:1.0};
  var now = new Date().toISOString().slice(0,19);
  return {
    timestamp: now,
    company_name: val('f_storename'),
    first_name: val('f_fname'),
    last_name: val('f_lname'),
    email: val('f_email'),
    phone: val('f_phone'),
    street: val('f_street'),
    city: val('f_city'),
    state: val('f_state'),
    zip: val('f_zip'),
    daily_traffic: V.traffic,
    fuel_price: V.fuelprice,
    daily_fuel_transactions: V.fillups,
    daily_instore_transactions: V.basefoot,
    basket_size: V.basket,
    baseline_capture_rate_pct: V.traffic > 0 ? (V.fillups/V.traffic*100).toFixed(2) : 0,
    client_corner: clientCorner || 'not set',
    homeward_direction: homeDir,
    competitor_count: comp.count,
    market_structure: comp.label.split('—')[0].trim(),
    corner_multiplier: clientCorner ? pos.mult : 1.0,
    competition_multiplier: comp.mult,
    combined_multiplier: compMultiplier(),
    monument_lift_pct: V.monument,
    gallons_per_fillup: V.gallons,
    window_boost_pct: V.window,
    basket_lift_pct: V.lift,
    customer_ltv: V.clv,
    zone_monument: activeZones.monument,
    zone_window: activeZones.window,
    zone_instore: activeZones.instore,
    incremental_daily: Math.round(m.ecnTotal),
    incremental_monthly: Math.round(m.ecnTotal * 30),
    incremental_annual: Math.round(m.ecnTotal * 365),
    baseline_daily_total: Math.round(m.baseTotalDay),
    ecn_daily_total: Math.round(m.afterTotal),
    new_loyal_per_month: Math.round(m.newLoyalPerMonth),
    ltv_monthly: Math.round(m.clvMonthly),
    sync_status: 'queued'
  };
}

function val(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function saveRecord() {
  var record = buildRecord();
  addToQueue(record);
  if (navigator.onLine) {
    syncQueue();
  } else {
    showSaveStatus('offline');
  }
}

function addToQueue(record) {
  var queue = getQueue();
  queue.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch(e) { return []; }
}

function syncQueue() {
  var queue = getQueue();
  var pending = queue.filter(function(r) { return r.sync_status === 'queued'; });
  if (pending.length === 0) return;

  var synced = 0;
  pending.forEach(function(record) {
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(record)
    }).then(function() {
      record.sync_status = 'synced';
      synced++;
      updateQueue(record);
      if (synced === pending.length) showSaveStatus('synced', synced);
    }).catch(function() {
      showSaveStatus('error');
    });
  });
}

function updateQueue(updatedRecord) {
  var queue = getQueue();
  queue = queue.map(function(r) {
    return r.timestamp === updatedRecord.timestamp &&
           r.email === updatedRecord.email ? updatedRecord : r;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function showSaveStatus(state, count) {
  var el = document.getElementById('save-status');
  if (!el) return;
  if (state === 'synced') el.textContent = (count > 1 ? count + ' records' : 'Record') + ' saved to log ✓';
  else if (state === 'offline') el.textContent = 'Saved offline — will sync when connected';
  else el.textContent = 'Sync error — saved locally';
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 4000);
}

function downloadCSV() {
  var queue = getQueue();
  if (queue.length === 0) { alert('No records saved yet.'); return; }
  var keys = Object.keys(queue[0]);
  var csv = keys.join(',') + '\n';
  queue.forEach(function(r) {
    csv += keys.map(function(k) {
      var v = r[k] === undefined ? '' : String(r[k]);
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(',') + '\n';
  });
  var blob = new Blob([csv], {type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ECN_leads_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

window.addEventListener('online', function() {
  syncQueue();
});
```

### Summary tab additions (Tab 5)

Add below the CLV card:

```html
<div id="save-section">
  <button id="save-btn" onclick="saveRecord()" class="btn-save">
    Save prospect record
  </button>
  <button onclick="downloadCSV()" class="btn-download">
    Download CSV log
  </button>
  <div id="save-status" style="display:none"></div>
  <div id="queue-count"></div>
</div>
```

Style:
- **Save button:** full-width, white background, dark blue text, bold — same as primary nav button
- **Download CSV:** full-width, secondary style (transparent, white border)
- **Save status:** small text below buttons, color-coded: teal for success, amber for offline, red for error
- **Queue count:** small muted text showing e.g. *"3 records pending sync"* — update on each tab visit

Add a `renderQueueStatus()` call whenever Tab 5 is opened to show pending count.

---

## 15. Google Apps Script (server side)

Create a new Google Sheet. Name the first sheet tab `Leads`. Then go to **Extensions → Apps Script** and paste this script:

```javascript
var SHEET_NAME = 'Leads';

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var data = JSON.parse(e.postData.contents);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(Object.keys(data));
    }
    sheet.appendRow(Object.values(data));

    return ContentService
      .createTextOutput(JSON.stringify({status:'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({status:'error', message:err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'ok', message:'ECN Logger active'}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Deployment steps:**
1. Click **Deploy → New deployment**
2. Type: **Web app**
3. Description: `ECN Lead Logger v1`
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Click **Deploy** — authorize when prompted
7. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/XXXXXXX/exec`)
8. Paste it into `index.html` replacing `YOUR_APPS_SCRIPT_DEPLOYMENT_URL_HERE`

**Important:** Any time you edit the Apps Script, you must create a **new deployment** (not update the existing one) and update the URL in `index.html`. Updating an existing deployment does not take effect immediately.

**Google Sheet column headers** are written automatically on the first submission. No manual setup of the Sheet structure is needed.

---

## 13. Suggested Claude Code build sequence

1. Scaffold the HTML shell with header, tab bar, and six empty tab content divs
2. Implement the CSS design system (colors, cards, inputs, buttons, sliders)
3. Build Tab 1 (Store info) with all input fields and live derived badges
4. Build Tab 2 (Competition) with intersection grid and analysis cards
5. Build Tab 3 (ECN impact) with sliders and avg markers
6. Build Tab 4 (Display zones) with toggle buttons
7. Implement the JavaScript revenue model (`model()` function)
8. Build Tab 5 (Summary) wired to the revenue model
9. Implement the data logging system (Section 14): `buildRecord()`, `saveRecord()`, `syncQueue()`, `downloadCSV()`, `online` event listener
10. Add Save and Download buttons to Tab 5 with status display and queue count
11. Build Tab 6 (References) as static content
12. Set `APPS_SCRIPT_URL` placeholder and test with the deployed Google Apps Script URL
13. Test all tab navigation, live updates, offline queue behavior, and edge cases (zero inputs, all zones off, no competition set, no contact info)
