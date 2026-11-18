const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const outputDir = path.join(root, 'dist');

const jsonScript = (id, value) => `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;

async function build() {
  const [sourceHtml, styles, app, tripInfoText, itineraryText] = await Promise.all([
    fs.readFile(path.join(publicDir, 'index.html'), 'utf8'),
    fs.readFile(path.join(publicDir, 'styles.css'), 'utf8'),
    fs.readFile(path.join(publicDir, 'app.js'), 'utf8'),
    fs.readFile(path.join(publicDir, 'trip-info.json'), 'utf8'),
    fs.readFile(path.join(root, 'data', 'itinerary.json'), 'utf8'),
  ]);
  const styleTag = '<link rel="stylesheet" href="/styles.css">';
  const appTag = '<script src="/app.js" defer></script>';
  if (!sourceHtml.includes('<body>') || !sourceHtml.includes(styleTag) || !sourceHtml.includes(appTag) || /<\/script/i.test(app)) {
    throw new Error('Static build source markers are missing or unsafe to inline');
  }

  const itinerary = JSON.parse(itineraryText);
  const tripInfo = JSON.parse(tripInfoText);
  if (!Array.isArray(itinerary)) throw new Error('Expected data/itinerary.json to contain an array');
  const updatedAt = (await fs.stat(path.join(root, 'data', 'itinerary.json'))).mtime.toISOString();
  let html = sourceHtml
    .replace('<body>', '<body class="static-site">')
    .replace(styleTag, `<style>\n${styles}\n</style>`)
    .replace(appTag, '');
  const embeddedData = `${jsonScript('itinerary-data', { itinerary, updatedAt })}\n${jsonScript('trip-info-data', tripInfo)}\n<script>\n${app}\n</script>\n`;
  html = html.replace('</body>', `${embeddedData}</body>`);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'index.html'), html);
  console.log(`Single-file static page created at ${path.relative(root, outputDir)}/index.html`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
