// Standalone Edge/CDP check: node --expose-gc --import tsx tests/location-browser.mjs
// Uses synthetic accounts, temporary SQLite, and intercepted geocoder/tile requests.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { createClient } from "@libsql/client";
import { SignJWT } from "jose/jwt/sign";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = await mkdtemp(join(tmpdir(), "grabstudent-address-browser-"));
const db = createClient({ url: `file:${join(dir, "browser.db")}` });
let server,
  edge,
  socket,
  serverOutput = "",
  count = 0;
const checks = [],
  errors = [],
  lookups = [];
const check = (condition, name) => {
  assert.ok(condition, name);
  checks.push(name);
  console.log("PASS", name);
};
const secret = "browser-address-test-only-32-character-secret";
try {
  const schema = await readFile("src/lib/schema.sql", "utf8");
  for (const sql of schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.execute(sql);
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO users (id,name,email,password_hash,student_number,phone_number,role,status,onboarding_seen_at,created_at,updated_at) VALUES ('passenger','Map Passenger','map@example.com','unused','MAP','+60123456789','passenger','approved',?,?,?)",
    args: [now, now, now],
  });
  const photo =
    "data:image/png;base64," +
    (await readFile("public/demo/student-id.png")).toString("base64");
  await db.execute({
    sql: "INSERT INTO users (id,name,email,password_hash,student_number,phone_number,role,status,student_id_doc,license_doc,profile_photo,car_colour,car_type,car_plate,onboarding_seen_at,created_at,updated_at) VALUES ('driver','Group Driver','group-driver@example.com','unused','DRIVER','+60123456780','driver','approved',?,?,?,'White','Perodua Myvi','TEST123',?,?,?)",
    args: [photo, photo, photo, now, now, now],
  });
  const port = await new Promise((r) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });
  const base = `http://localhost:${port}`;
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        TURSO_DATABASE_URL: `file:${join(dir, "browser.db")}`,
        AUTH_SECRET: secret,
        NEXT_PUBLIC_DEMO_MODE: "false",
        GRABSTUDENT_DIST_DIR: ".next-test",
      },
    },
  );
  server.stdout.on("data", (data) => (serverOutput += data));
  server.stderr.on("data", (data) => (serverOutput += data));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base + "/login")).ok) break;
    } catch {}
    if (server.exitCode !== null || i === 119) throw new Error(serverOutput);
    await delay(500);
  }
  edge = spawn(
    process.env.EDGE_PATH ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${join(dir, "edge")}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let debugPort;
  for (let i = 0; i < 100; i++) {
    try {
      debugPort = (
        await readFile(join(dir, "edge", "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {}
    await delay(100);
  }
  assert.ok(debugPort, "Edge debugging ready");
  const tabs = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/list`)
  ).json();
  socket = new WebSocket(
    tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((r) => socket.addEventListener("open", r, { once: true }));
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((r, reject) => {
      const id = ++count;
      pending.set(id, { r, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  let reverseMode = "normal";
  const location = (address, lat = 3.1341, lng = 101.6865) => ({
    address,
    lat,
    lng,
  });
  socket.addEventListener("message", async (event) => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const task = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) task?.reject(new Error(data.error.message));
      else task?.r(data.result);
      return;
    }
    if (data.method === "Runtime.exceptionThrown")
      errors.push(data.params.exceptionDetails.text);
    if (data.method !== "Fetch.requestPaused") return;
    const { requestId, request } = data.params;
    try {
      let body,
        status = 200,
        contentType;
      if (request.url.includes("tile.openstreetmap.org")) {
        body =
          '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eee9f4"/><path d="M0 70H256M70 0V256M0 210H256M210 0V256" stroke="#fff" stroke-width="14"/><text x="90" y="132" fill="#9b88b6" font-size="12">TEST MAP</text></svg>';
        contentType = "image/svg+xml";
      } else {
        const input = JSON.parse(request.postData);
        lookups.push(input);
        await delay(
          input.query === "Slow address" || reverseMode === "slow" ? 1200 : 200,
        );
        if (
          input.query === "Unavailable" ||
          (input.action === "reverse" && reverseMode === "failure")
        ) {
          status = 503;
          body = {
            error:
              "Address lookup is temporarily unavailable. Please try again or mark the map and enter the address manually.",
          };
        } else if (input.query === "No match") body = { locations: [] };
        else if (input.action === "reverse")
          body = {
            locations: [
              location(
                `Mapped address ${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`,
                input.lat,
                input.lng,
              ),
            ],
          };
        else if (input.query === "Many places")
          body = {
            locations: [
              location("First station, Town"),
              location("Second station, Town", 3.16, 101.71),
              location("Third station, Town", 3.17, 101.72),
            ],
          };
        else
          body = {
            locations: [
              location(
                input.query === "Slow address"
                  ? "Old slow result"
                  : "KL Sentral, Jalan Stesen Sentral, Kuala Lumpur, Malaysia",
              ),
            ],
          };
        body = JSON.stringify(body);
        contentType = "application/json";
      }
      await send("Fetch.fulfillRequest", {
        requestId,
        responseCode: status,
        responseHeaders: [{ name: "Content-Type", value: contentType }],
        body: Buffer.from(body).toString("base64"),
      });
    } catch {
      /* A canceled request may no longer exist. */
    }
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Fetch.enable", {
    patterns: [
      { urlPattern: "*tile.openstreetmap.org/*" },
      { urlPattern: "*/api/locations" },
    ],
  });
  const token = await new SignJWT({
    sub: "passenger",
    role: "passenger",
    status: "approved",
    session_version: 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await send("Network.setCookie", {
    name: "gs_session",
    value: token,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  const until = async (expression, name, timeout = 20000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(`!!(${expression})`)) return;
      await delay(100);
    }
    console.error(
      "Browser state",
      await evaluate(
        '({url:location.href,text:document.body.innerText.slice(-2000),cards:[...document.querySelectorAll(".current-booking-card")].map(e=>({id:e.id,complete:e.dataset.complete})),loading:!!document.querySelector(".booking-progress")})',
      ),
    );
    console.error("Browser exceptions", errors);
    console.error("Server tail", serverOutput.slice(-2500));
    throw new Error("Timed out: " + name);
  };
  const setInput = async (selector, value) =>
    evaluate(
      `(() => { const e=document.querySelector(${JSON.stringify(selector)});e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
  const fieldSelector = (index) => `.location-field:nth-of-type(${index + 1})`;
  const fieldInput = (index) => fieldSelector(index) + " > label input";
  const click = async (selector) =>
    evaluate(
      `(() => { const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing button');e.scrollIntoView({block:'center'});e.click(); })()`,
    );
  const find = (index) =>
    click(fieldSelector(index) + " .location-address-tools button");
  const open = async (index) => {
    await click(fieldSelector(index) + " .location-pin-button");
    await until(
      "document.querySelector('.journey-map.leaflet-container') && !document.querySelector('.journey-map-loading')",
      "map ready",
    );
  };
  const save = async () => {
    await until(
      "document.querySelector('.location-modal .btn-primary') && !document.querySelector('.location-modal .btn-primary').disabled",
      "address ready",
    );
    await click(".location-modal .btn-primary");
    await until("!document.querySelector('.location-modal')", "saved dialog");
  };
  const tapMap = async () => {
    await evaluate(
      "document.querySelector('.journey-map').scrollIntoView({block:'center'})",
    );
    const point = await evaluate(
      "(() => {const r=document.querySelector('.journey-map').getBoundingClientRect();return {x:r.x+r.width*0.6,y:r.y+r.height*0.6};})()",
    );
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...point,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...point,
    });
  };
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await db.execute(
    "INSERT INTO bookings (id,driver_id,passenger_id,from_zone,to_zone,departure_at,status,quoted_price,payment_method,arrived_at,created_at,updated_at) VALUES ('stale-arrival','driver','passenger','Previous pickup','Previous destination','2020-01-01T00:00:00Z','accepted',500,'cash','2020-01-01T00:01:00Z','2000-01-01T00:00:00Z','2000-01-01T00:00:00Z')",
  );
  await send("Page.navigate", { url: base + "/passenger" });
  await until(
    "document.querySelector('.page-heading') && document.querySelectorAll('.location-field').length===2 && !document.querySelector('.page-loading') && !document.querySelector('.booking-progress')",
    "passenger hydrated",
  );
  await until(
    "document.querySelector('.arrival-popup')",
    "previous pickup popup",
  );
  await click(".arrival-popup .btn-secondary");
  check(
    await evaluate("!!document.querySelector('.arrival-notice')"),
    "previous booking initially shows its pickup update",
  );
  await delay(300);
  check(
    await evaluate(
      "[...document.querySelectorAll('.location-field > label input')].every(e=>e.value==='' && !e.hasAttribute('list')) && !document.querySelector('.location-field datalist')",
    ),
    "blank address fields without preset dropdowns",
  );
  check(
    await evaluate(
      "document.querySelector('input[name=passenger_count]:checked').value==='1'",
    ),
    "passenger count starts at one and includes the person booking",
  );
  await click(".passenger-count-options label:nth-child(4)");
  check(
    await evaluate(
      "document.querySelector('input[name=passenger_count]:checked').value==='4' && document.querySelector('.passenger-count-summary').textContent.includes('4 people')",
    ),
    "passenger count choice updates pickup summary",
  );
  await evaluate(
    "document.querySelector('input[name=passenger_count]:checked').focus()",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
  });
  check(
    await evaluate(
      "document.querySelector('input[name=passenger_count]:checked').value==='3'",
    ),
    "passenger count is keyboard accessible",
  );
  await setInput(fieldInput(0), "KL Sentral");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await until(
    "document.querySelector('.location-address-loading')",
    "search loading",
  );
  check(
    await evaluate(
      "!!document.querySelector('.location-address-loading .booking-progress-emblem')",
    ),
    "existing GrabStudent loading motif",
  );
  await until(
    "document.querySelector('.location-field .is-marked')",
    "pickup linked",
  );
  check(
    await evaluate(
      `document.querySelector(${JSON.stringify(fieldInput(0))}).value.startsWith('KL Sentral,')`,
    ),
    "Enter searches and fills the resolved pickup address",
  );
  await open(0);
  check(
    await evaluate(
      "document.querySelector('.location-selected-address').textContent.includes('3.13410, 101.68650') && !!document.querySelector('.journey-map-pin.pickup')",
    ),
    "pickup pin matches the address result",
  );
  await tapMap();
  check(
    await evaluate(
      "document.querySelector('.location-modal .btn-primary').disabled",
    ),
    "map changes wait for matching address before saving",
  );
  await save();
  const pickupAddress = await evaluate(
    `document.querySelector(${JSON.stringify(fieldInput(0))}).value`,
  );
  check(
    pickupAddress.startsWith("Mapped address"),
    "map selection updates the pickup field",
  );
  await setInput(fieldInput(1), "Many places");
  await find(1);
  await until(
    "document.querySelectorAll('.location-address-results button').length===3",
    "address matches",
  );
  check(
    await evaluate(
      "document.querySelector('.location-address-results').scrollHeight===document.querySelector('.location-address-results').clientHeight",
    ),
    "address matches use visible buttons without a scroll list",
  );
  for (const [width, height] of [
    [320, 800],
    [390, 844],
    [844, 390],
    [1280, 850],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await delay(150);
    check(
      await evaluate(
        "document.documentElement.scrollWidth<=innerWidth+1 && [...document.querySelectorAll('.location-address-results button,.location-address-tools button')].every(e=>e.getBoundingClientRect().height>=44)",
      ),
      `address controls fit ${width}px with touch targets`,
    );
    check(
      await evaluate(
        "[...document.querySelectorAll('.passenger-count-options label > span')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44 && r.height>=44 && r.right<=innerWidth+1;})",
      ),
      `passenger choices fit ${width}px with touch targets`,
    );
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await click(".location-address-results button:nth-of-type(2)");
  check(
    await evaluate(
      `document.querySelector(${JSON.stringify(fieldInput(1))}).value==='Second station, Town' && document.querySelector(${JSON.stringify(fieldInput(0))}).value===${JSON.stringify(pickupAddress)}`,
    ),
    "destination choice leaves pickup unchanged",
  );
  await open(1);
  check(
    await evaluate(
      "!!document.querySelector('.journey-map-pin.destination') && document.querySelector('.location-selected-address').textContent.includes('3.16000, 101.71000')",
    ),
    "destination address has its own destination marker",
  );
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    "docs/screenshots/mobile-address-sync.png",
    Buffer.from(screenshot.data, "base64"),
  );
  await send("Browser.grantPermissions", {
    origin: base,
    permissions: ["geolocation"],
  });
  await send("Emulation.setGeolocationOverride", {
    latitude: 3.155,
    longitude: 101.705,
    accuracy: 10,
  });
  await click(".location-map-tools button:first-child");
  await save();
  check(
    await evaluate(
      `document.querySelector(${JSON.stringify(fieldInput(1))}).value.includes('3.15500, 101.70500')`,
    ),
    "GPS lookup updates matching address and retains GPS point",
  );
  await setInput(fieldInput(0), "Slow address");
  await find(0);
  await delay(150);
  await setInput(fieldInput(0), "A newer address");
  await delay(1500);
  check(
    await evaluate(
      `document.querySelector(${JSON.stringify(fieldInput(0))}).value==='A newer address' && !document.querySelector(${JSON.stringify(fieldSelector(0) + " .is-marked")}) && document.querySelector('.create-form > .btn-primary').disabled`,
    ),
    "editing clears old pin and ignores late search results",
  );
  await setInput(fieldInput(0), "No match");
  await find(0);
  await until(
    "document.querySelector('.location-field').textContent.includes('No matching address')",
    "no match feedback",
  );
  check(
    await evaluate(
      "!document.querySelector('.location-field:first-of-type .is-marked')",
    ),
    "unmatched addresses do not retain a stale pin",
  );
  await setInput(fieldInput(0), "Unavailable");
  await find(0);
  await until(
    "document.querySelector('.location-field').textContent.includes('temporarily unavailable')",
    "search failure",
  );
  reverseMode = "failure";
  await open(0);
  await tapMap();
  await until(
    "document.querySelector('.location-selected-address input')",
    "manual fallback",
  );
  check(
    await evaluate(
      "document.querySelector('.location-selected-address input').value==='' && document.querySelector('.location-modal .btn-primary').disabled",
    ),
    "failed reverse lookup clears old address and needs a new one",
  );
  await setInput(
    ".location-selected-address input",
    "Side gate, Main Street, Town",
  );
  await save();
  check(
    await evaluate(
      `document.querySelector(${JSON.stringify(fieldInput(0))}).value==='Side gate, Main Street, Town' && !!document.querySelector(${JSON.stringify(fieldSelector(0) + " .is-marked")})`,
    ),
    "manual fallback saves an address with the chosen exact point",
  );
  reverseMode = "normal";
  await open(0);
  await tapMap();
  await until(
    "document.querySelector('.location-selected-address p')?.textContent.startsWith('Mapped address')",
    "reverse retry",
  );
  await click(".location-modal .action-group .btn-secondary");
  check(
    await evaluate(
      `document.querySelector(${JSON.stringify(fieldInput(0))}).value==='Side gate, Main Street, Town'`,
    ),
    "cancel leaves the saved address and pin unchanged",
  );
  reverseMode = "slow";
  await open(0);
  await tapMap();
  await delay(1000);
  await click(".location-modal .action-group .btn-secondary");
  await delay(1400);
  check(
    await evaluate(
      `document.querySelector(${JSON.stringify(fieldInput(0))}).value==='Side gate, Main Street, Town' && !document.querySelector('.location-address-loading')`,
    ),
    "closing a pending lookup prevents late updates and clears loading",
  );
  reverseMode = "normal";
  await open(0);
  await tapMap();
  await save();
  const pickupLookup = lookups
    .filter((item) => item.action === "reverse")
    .at(-1);
  const postedPickup = await evaluate(
    `document.querySelector(${JSON.stringify(fieldInput(0))}).value`,
  );
  await click(".passenger-count-options label:nth-child(3)");
  await evaluate(
    "document.querySelector('.passenger-count-field').scrollIntoView({block:'center'})",
  );
  const countPreview = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    "docs/screenshots/mobile-passenger-count.png",
    Buffer.from(countPreview.data, "base64"),
  );
  await setInput("input[type=datetime-local]", "2099-10-08T12:00");
  await click(".create-form > .btn-primary");
  await until(
    "document.body.textContent.includes('Request posted.') && document.querySelector('.current-booking-card') && document.querySelector('.current-booking-card') && !document.querySelector('.booking-progress')",
    "booking posted",
  );
  const savedBooking = (
    await db.execute(
      "SELECT * FROM bookings WHERE passenger_id='passenger' ORDER BY created_at DESC,id DESC LIMIT 1",
    )
  ).rows[0];
  check(
    savedBooking.from_zone === postedPickup &&
      savedBooking.pickup_lat === pickupLookup.lat &&
      savedBooking.pickup_lng === pickupLookup.lng &&
      savedBooking.destination_lat === 3.155 &&
      savedBooking.destination_lng === 101.705,
    "booking persists both synchronized addresses and exact pins",
  );
  check(
    savedBooking.passenger_count === 3,
    "booking stores the selected group size",
  );
  check(
    await evaluate(
      "document.querySelector('input[name=passenger_count]:checked').value==='1' && document.querySelector('.current-bookings .passenger-count-badge').textContent.includes('3 passengers') && document.querySelector('.current-booking-card .passenger-count-badge').textContent.includes('3 passengers')",
    ),
    "posted request shows the group count and resets the picker",
  );
  check(
    await evaluate(
      "[...document.querySelectorAll('.location-field > label input')].every(e=>e.value==='')",
    ),
    "posted request resets both location fields",
  );
  await send("Page.reload");
  await until(
    "document.querySelector('.current-booking-card') && !document.querySelector('.booking-progress')",
    "booking restored after refresh",
  );
  check(
    await evaluate(
      `document.querySelector('.current-booking-card').textContent.includes(${JSON.stringify(postedPickup)})`,
    ),
    "refresh preserves the saved booking address",
  );
  check(
    await evaluate(
      "document.querySelector('.current-booking-card .passenger-count-badge').textContent.includes('3 passengers')",
    ),
    "passenger count survives refresh",
  );
  check(
    await evaluate(
      "!document.querySelector('.arrival-notice') && !document.querySelector('.arrival-popup') && document.querySelectorAll('.current-booking-card').length===1",
    ),
    "new request clears the old pickup update and keeps it cleared after refresh",
  );
  check(
    (
      await db.execute(
        "SELECT arrived_at FROM bookings WHERE id='stale-arrival'",
      )
    ).rows[0].arrived_at === "2020-01-01T00:01:00Z",
    "new requests preserve historical pickup records",
  );
  await db.execute("DELETE FROM bookings WHERE id='stale-arrival'");
  const driverToken = await new SignJWT({
    sub: "driver",
    role: "driver",
    status: "approved",
    session_version: 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await send("Network.setCookie", {
    name: "gs_session",
    value: driverToken,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  });
  await send("Page.navigate", { url: base + "/driver" });
  await until(
    "document.querySelector('.fare-offer') && !document.querySelector('.page-loading') && !document.querySelector('.booking-progress')",
    "driver group request",
  );
  check(
    await evaluate(
      "document.querySelector('.booking-item .passenger-count-badge').textContent.includes('3 passengers') && document.querySelector('.fare-offer label').textContent.includes('Total fare for 3 passengers')",
    ),
    "driver sees the passenger total before offering a group fare",
  );
  await setInput(".fare-input", "12.50");
  await click(".fare-offer button[type=submit]");
  await until(
    "document.querySelector('.booking-actions') && !document.querySelector('.booking-progress')",
    "driver selected group",
  );
  check(
    await evaluate(
      "document.querySelector('.booking-person .passenger-count-badge').textContent.includes('3 passengers')",
    ),
    "selected passenger cards retain the group count",
  );
  const offered = (
    await db.execute({
      sql: "SELECT * FROM bookings WHERE id=?",
      args: [savedBooking.id],
    })
  ).rows[0];
  check(
    offered.passenger_count === 3 && offered.quoted_price === 1250,
    "driver fare is the group total and preserves passenger count",
  );
  await send("Page.navigate", { url: base + "/history" });
  await until(
    "document.querySelector('tbody .passenger-count-badge') && !document.querySelector('.booking-progress')",
    "driver group history",
  );
  check(
    await evaluate(
      "document.querySelector('tbody .passenger-count-badge').textContent.includes('3 passengers')",
    ),
    "driver history includes passenger count",
  );
  await send("Network.setCookie", {
    name: "gs_session",
    value: token,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  });
  await send("Page.navigate", { url: base + "/passenger" });
  await until(
    "document.querySelector('.current-booking-card .btn-action') && !document.querySelector('.booking-progress')",
    "passenger price offer",
  );
  check(
    await evaluate(
      "document.querySelector('.current-booking-status').textContent.includes('Review price') && document.querySelectorAll('.current-booking-steps li[data-state=done]').length===1",
    ),
    "offered bookings still wait for passenger agreement",
  );
  check(
    await evaluate(
      "document.querySelector('.current-booking-card').textContent.includes('total for this booking')",
    ),
    "confirmation displays the total booking fare",
  );
  await click(".current-booking-card .btn-action");
  await until(
    "document.querySelector('.current-booking-card[data-complete=true]') && !document.querySelector('.booking-progress')",
    "booking progress complete",
  );
  check(
    await evaluate(
      "document.querySelector('.current-booking-status').textContent.trim()==='Complete' && document.querySelectorAll('.current-booking-steps li[data-state=done]').length===3 && !document.querySelector('.current-booking-steps [aria-current]')",
    ),
    "agreeing to the fare completes every current-booking step",
  );
  const confirmed = (
    await db.execute({
      sql: "SELECT status,arrived_at FROM bookings WHERE id=?",
      args: [savedBooking.id],
    })
  ).rows[0];
  check(
    confirmed.status === "accepted" && confirmed.arrived_at === null,
    "complete booking progress preserves the confirmed journey for pickup reminders",
  );
  await evaluate(
    "document.querySelector('.current-bookings').scrollIntoView({block:'center'})",
  );
  const completePreview = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    "docs/screenshots/mobile-booking-complete.png",
    Buffer.from(completePreview.data, "base64"),
  );
  await send("Page.reload");
  await until(
    "document.querySelector('.current-booking-card[data-complete=true]') && !document.querySelector('.booking-progress')",
    "completed booking after refresh",
  );
  check(
    await evaluate(
      "document.querySelectorAll('.current-booking-steps li[data-state=done]').length===3",
    ),
    "booking completion persists after refresh",
  );
  for (const [id, from, created, departure] of [
    [
      "ui-newest",
      "Newest pickup",
      "2099-05-04T00:00:00.000Z",
      "2099-10-01T04:00:00.000Z",
    ],
    [
      "ui-older",
      "Older pickup",
      "2099-05-03T00:00:00.000Z",
      "2099-12-01T04:00:00.000Z",
    ],
  ])
    await db.execute({
      sql: "INSERT INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,status,payment_method,created_at,updated_at) VALUES (?,'passenger',?,'Sort destination',?,'pending','cash',?,?)",
      args: [id, from, departure, created, created],
    });
  await send("Page.reload");
  await until(
    "document.querySelector('.current-booking-card h3')?.textContent.includes('Newest pickup') && !document.querySelector('.booking-progress')",
    "newest current booking",
  );
  check(
    await evaluate(
      "document.querySelector('.current-booking-card h3').textContent.includes('Newest pickup') && document.querySelectorAll('.current-booking-card').length===1 && !document.querySelector('.booking-item') && !document.body.textContent.includes('My active requests') && document.querySelector('.current-bookings').compareDocumentPosition(document.querySelector('.page-heading'))===4",
    ),
    "only the single newest booking appears at the top without Active Requests",
  );
  await send("Page.navigate", { url: base + "/history" });
  await until(
    "document.querySelector('tbody tr')?.textContent.includes('Newest pickup') && !document.querySelector('.booking-progress')",
    "newest history row",
  );
  const selectStatus = async (status) =>
    evaluate(
      `(() => {const e=document.querySelector('select[aria-label="Filter booking status"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(status)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  await selectStatus("pending");
  await until(
    "document.querySelectorAll('tbody tr').length===2",
    "pending history filter",
  );
  check(
    await evaluate(
      "document.querySelectorAll('tbody tr').length===2 && document.querySelector('tbody tr').textContent.includes('Newest pickup')",
    ),
    "history status filters retain newest-first order",
  );
  await selectStatus("accepted");
  await until(
    "document.querySelectorAll('tbody tr').length===1",
    "booked history filter",
  );
  check(
    await evaluate(
      `document.querySelectorAll('tbody tr').length===1 && document.querySelector('tbody tr').textContent.includes(${JSON.stringify(postedPickup)})`,
    ),
    "confirmed bookings remain available in the booked history filter",
  );
  await send("Network.setCookie", {
    name: "gs_session",
    value: driverToken,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  });
  await send("Page.navigate", { url: base + "/driver" });
  await until(
    "document.querySelector('.fare-offer') && document.querySelector('.driver-arrival button') && !document.querySelector('.booking-progress')",
    "latest driver requests and booked pickup",
  );
  check(
    await evaluate(
      "document.querySelector('.booking-info').textContent.includes('Newest pickup')",
    ),
    "drivers see the newest available request first",
  );
  await setInput(".filter-panel label:nth-child(2) input", "Sort destination");
  await click(".filter-panel > button");
  await until(
    "document.querySelectorAll('.fare-offer').length===2 && !document.querySelector('.booking-progress')",
    "filtered driver requests",
  );
  check(
    await evaluate(
      "document.querySelector('.booking-info').textContent.includes('Newest pickup') && !!document.querySelector('.driver-arrival button')",
    ),
    "driver filters retain newest-first order and booked pickup actions",
  );

  await click(".driver-arrival button");
  await until(
    "document.querySelector('.driver-arrival').textContent.includes('Arrival reminder sent') && !document.querySelector('.booking-progress')",
    "driver arrival saved",
  );
  const arrivedRow = (
    await db.execute({
      sql: "SELECT arrived_at FROM bookings WHERE id=?",
      args: [savedBooking.id],
    })
  ).rows[0];
  check(
    !!arrivedRow.arrived_at,
    "driver arrival still works after dashboard rearrangement",
  );
  await send("Network.setCookie", {
    name: "gs_session",
    value: token,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  });
  await send("Page.navigate", { url: base + "/passenger" });
  await until(
    "document.querySelector('.current-booking-card h3')?.textContent.includes('Newest pickup') && !document.querySelector('.booking-progress')",
    "latest booking after old driver arrived",
  );
  await delay(300);
  check(
    await evaluate(
      "!document.querySelector('.arrival-popup') && !document.querySelector('.arrival-notice')",
    ),
    "an older driver arrival cannot replace the latest request pickup update",
  );
  await click(".current-booking-content > .btn-secondary");
  await until(
    "document.querySelector('[aria-labelledby=cancel-request-title]')",
    "latest booking cancellation dialog",
  );
  await click(".modal-box .btn-danger");
  await until(
    "document.querySelector('.current-booking-status')?.textContent.includes('Cancelled') && !document.querySelector('.booking-progress')",
    "latest booking cancelled",
  );
  check(
    await evaluate(
      "document.querySelectorAll('.current-booking-card').length===1 && document.querySelector('.current-booking-card h3').textContent.includes('Newest pickup') && !document.querySelector('.arrival-notice') && !document.querySelector('.arrival-popup')",
    ),
    "cancelled latest request remains displayed without resurfacing older pickup details",
  );
  await db.execute({
    sql: "UPDATE bookings SET departure_at=? WHERE id=?",
    args: [new Date(Date.now() - 3600000).toISOString(), savedBooking.id],
  });
  await send("Page.navigate", { url: base + "/history" });
  await until(
    "document.querySelector('[data-action=rate-driver]') && !document.querySelector('.booking-progress')",
    "older booking can be rated from History",
  );
  await click("[data-action=rate-driver]");
  await until("document.querySelector('.rating-modal')", "rating modal");
  check(
    await evaluate(
      "document.querySelector('.rating-modal .btn-primary').disabled",
    ),
    "rating requires a score and ride-finished confirmation",
  );
  await click(".rating-stars label:nth-of-type(4)");
  await evaluate(
    "document.querySelector('.rating-stars input:checked').focus()",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowLeft",
    code: "ArrowLeft",
    windowsVirtualKeyCode: 37,
  });
  check(
    await evaluate(
      "document.querySelector('.rating-stars input:checked').value==='3'",
    ),
    "star ratings support keyboard navigation",
  );
  await click(".rating-stars label:nth-of-type(4)");
  await evaluate(
    "(() => {const e=document.querySelector('.rating-modal textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Friendly driver and easy pickup.');e.dispatchEvent(new Event('input',{bubbles:true}));})()",
  );
  await click(".rating-finished input");
  await evaluate(
    'Promise.all(document.querySelector(".rating-modal").getAnimations().map(animation=>animation.finished))',
  );
  for (const width of [320, 390, 844, 1280]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await delay(200);
    check(
      await evaluate(
        "document.documentElement.scrollWidth<=innerWidth+1 && [...document.querySelectorAll('.rating-star')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44 && r.height>=44 && r.left>=0 && r.right<=innerWidth})",
      ),
      "rating modal fits " +
        width +
        "px and provides accessible star touch targets",
    );
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(200);
  const ratingPreview = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    "docs/screenshots/mobile-driver-rating.png",
    Buffer.from(ratingPreview.data, "base64"),
  );
  await click(".rating-modal .btn-primary");
  await until(
    "!document.querySelector('.rating-modal') && document.querySelector('.ride-rating-saved') && !document.querySelector('.booking-progress')",
    "rating submitted",
  );
  const rated = (
    await db.execute({
      sql: "SELECT status,rating_score,rating_feedback,arrived_at FROM bookings WHERE id=?",
      args: [savedBooking.id],
    })
  ).rows[0];
  check(
    rated.status === "completed" &&
      rated.rating_score === 4 &&
      rated.rating_feedback === "Friendly driver and easy pickup." &&
      rated.arrived_at === arrivedRow.arrived_at,
    "rating saves feedback, completes the finished ride and retains its arrival",
  );
  await send("Page.reload");
  await until(
    "document.querySelector('.ride-rating-saved') && !document.querySelector('.booking-progress')",
    "rating after refresh",
  );
  check(
    await evaluate(
      "!document.querySelector('[data-action=rate-driver]') && document.querySelector('.ride-rating-saved').textContent.includes('4/5')",
    ),
    "saved rating survives refresh and cannot be resubmitted",
  );
  await send("Network.setCookie", {
    name: "gs_session",
    value: driverToken,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  });
  await send("Page.navigate", { url: base + "/driver" });
  await until(
    "document.querySelector('.driver-rating-summary')?.textContent.includes('4.0/5') && !document.querySelector('.booking-progress')",
    "driver rating summary",
  );
  await click(".driver-rating-summary summary");
  check(
    await evaluate(
      "document.querySelector('.rating-review').textContent.includes('Friendly driver and easy pickup.')",
    ),
    "driver sees average stars and passenger feedback on the dashboard",
  );
  check(errors.length === 0, "no browser runtime exceptions");
  console.log(`${checks.length} address browser checks passed`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  socket?.close();
  for (const processToStop of [edge, server]) {
    if (!processToStop?.pid) continue;
    if (process.platform === "win32")
      await new Promise((r) => {
        const child = spawn(
          "taskkill",
          ["/pid", String(processToStop.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        child.once("exit", r);
        child.once("error", r);
      });
    else processToStop.kill("SIGTERM");
  }
  db.close();
  global.gc?.();
  await delay(250);
  assert.ok(
    resolve(dir).startsWith(resolve(tmpdir(), "grabstudent-address-browser-")),
  );
  await rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
}
