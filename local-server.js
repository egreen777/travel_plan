const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data', 'itinerary.json');
const PORT = Number(process.env.PORT || 3000);
const EDITOR_TOKEN = process.env.EDITOR_TOKEN || '';
let writeQueue = Promise.resolve();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function hasEditorAccess(req) {
  if (!EDITOR_TOKEN) return false;
  const value = req.headers.authorization || '';
  return value === `Bearer ${EDITOR_TOKEN}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateAndNormalize(input) {
  if (!Array.isArray(input)) return { error: 'itinerary must be an array' };

  const ids = new Set();
  const dateCounts = new Map();
  const normalized = input.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Item ${index + 1} must be an object`);
    }
    const date = String(entry.date || '');
    const startTime = String(entry.startTime || '');
    const title = String(entry.title || '').trim();
    const location = String(entry.location || '').trim();
    const note = entry.note == null ? '' : String(entry.note);
    const durationMinutes = entry.durationMinutes;
    const travelMinutesToNext = entry.travelMinutesToNext;
    const transportToNext = entry.transportToNext == null ? null : String(entry.transportToNext).trim();
    const mealSlot = entry.mealSlot == null || entry.mealSlot === '' ? null : String(entry.mealSlot);
    const sourceUrl = entry.sourceUrl == null || entry.sourceUrl === '' ? null : String(entry.sourceUrl).trim();
    const lat = Number(entry.lat);
    const lng = Number(entry.lng);
    const id = entry.id == null || entry.id === '' ? crypto.randomUUID() : String(entry.id);

    if (!isValidDate(date)) throw new Error(`Item ${index + 1} has an invalid date`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new Error(`Item ${index + 1} has an invalid start time`);
    if (!title) throw new Error(`Item ${index + 1} needs a title`);
    if (!location) throw new Error(`Item ${index + 1} needs a location`);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 0) throw new Error(`Item ${index + 1} has an invalid duration`);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`Item ${index + 1} has an invalid latitude`);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`Item ${index + 1} has an invalid longitude`);
    if (mealSlot && !['breakfast', 'lunch', 'dinner'].includes(mealSlot)) throw new Error(`Item ${index + 1} has an invalid meal slot`);
    if (sourceUrl) {
      try {
        if (new URL(sourceUrl).protocol !== 'https:') throw new Error();
      } catch {
        throw new Error(`Item ${index + 1} has an invalid source URL`);
      }
    }
    if (entry.id != null && entry.id !== '' && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`Item ${index + 1} has an invalid id`);
    if (ids.has(id)) throw new Error(`Duplicate id: ${id}`);
    ids.add(id);

    dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
    return { id, date, startTime, title, location, note, durationMinutes, transportToNext, travelMinutesToNext, lat, lng, mealSlot, sourceUrl };
  });

  const seenByDate = new Map();
  normalized.forEach((entry, index) => {
    const position = seenByDate.get(entry.date) || 0;
    const isLastForDate = position === dateCounts.get(entry.date) - 1;
    const hasTravel = entry.travelMinutesToNext !== null && entry.travelMinutesToNext !== undefined;
    if (isLastForDate) {
      entry.transportToNext = null;
      entry.travelMinutesToNext = null;
    } else {
      if (!hasTravel || !Number.isInteger(entry.travelMinutesToNext) || entry.travelMinutesToNext < 0) {
        throw new Error(`Item ${index + 1} needs a valid travel time to the next stop`);
      }
      if (!entry.transportToNext) throw new Error(`Item ${index + 1} needs transport to the next stop`);
    }
    seenByDate.set(entry.date, position + 1);
  });

  return { itinerary: normalized };
}

async function readItinerary() {
  const content = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(content);
  const result = validateAndNormalize(parsed);
  if (result.error) throw new Error(result.error);
  return result.itinerary;
}

function queueWrite(itinerary) {
  const operation = writeQueue.then(async () => {
    const tempFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(itinerary, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, DATA_FILE);
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 1_000_000) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requested}`);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) return sendText(res, 404, 'Not found');
  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extension] || 'application/octet-stream' });
    res.end(file);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = requestUrl;

  try {
    if (req.method === 'GET' && pathname === '/api/itinerary') {
      const itinerary = await readItinerary();
      return sendJson(res, 200, { itinerary, updatedAt: (await fs.stat(DATA_FILE)).mtime.toISOString() });
    }

    if (req.method === 'GET' && pathname === '/api/editor/session') {
      if (!hasEditorAccess(req)) return sendJson(res, 401, { error: 'Invalid editor token' });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'PUT' && pathname === '/api/itinerary') {
      if (!hasEditorAccess(req)) return sendJson(res, 401, { error: 'Invalid editor token' });
      let payload;
      try {
        payload = JSON.parse(await readRequestBody(req));
      } catch (error) {
        return sendJson(res, 400, { error: error.message === 'Request body is too large' ? error.message : 'Request body must be valid JSON' });
      }
      let validated;
      try {
        validated = validateAndNormalize(payload && payload.itinerary);
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
      if (validated.error) return sendJson(res, 400, { error: validated.error });
      await queueWrite(validated.itinerary);
      return sendJson(res, 200, { itinerary: validated.itinerary, updatedAt: new Date().toISOString() });
    }

    if (req.method === 'GET') return serveStatic(req, res, pathname);
    return sendText(res, 405, 'Method not allowed');
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: 'Unable to complete the request' });
  }
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Trip itinerary map listening on http://localhost:${PORT}`);
    if (!EDITOR_TOKEN) console.warn('EDITOR_TOKEN is not set; edit saves are disabled.');
  });
}

module.exports = { server, validateAndNormalize };
