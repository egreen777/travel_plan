const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const outputDir = path.join(root, 'dist');
const itineraryFile = path.join(root, 'data', 'itinerary.json');

async function build() {
  const [sourceHtml, itineraryText] = await Promise.all([
    fs.readFile(path.join(publicDir, 'index.html'), 'utf8'),
    fs.readFile(itineraryFile, 'utf8'),
  ]);
  if (!sourceHtml.includes('<body>')) throw new Error('public/index.html must contain a <body> tag');

  const itinerary = JSON.parse(itineraryText);
  if (!Array.isArray(itinerary)) throw new Error('Expected data/itinerary.json to contain an array');
  const updatedAt = (await fs.stat(itineraryFile)).mtime.toISOString();

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outputDir, 'index.html'), sourceHtml.replace('<body>', '<body class="static-site">')),
    fs.copyFile(path.join(publicDir, 'styles.css'), path.join(outputDir, 'styles.css')),
    fs.copyFile(path.join(publicDir, 'app.js'), path.join(outputDir, 'app.js')),
    fs.copyFile(path.join(publicDir, 'trip-info.json'), path.join(outputDir, 'trip-info.json')),
    fs.writeFile(path.join(outputDir, 'itinerary.json'), `${JSON.stringify({ itinerary, updatedAt }, null, 2)}\n`),
  ]);
  console.log(`Static site created in ${path.relative(root, outputDir)}/`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
