#!/usr/bin/env node
/**
 * Brief Design System — Generic Builder
 *
 * Usage:
 *   node build.js <data-file.json>
 *   node build.js data/my-brief.json
 *
 * Output:
 *   output/<stem>/index.html
 *
 * Template:
 *   Uses template.html in the same directory (or pass --template path)
 */

const { Liquid } = require('liquidjs');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node build.js <data-file.json> [--template custom-template.html]');
  process.exit(1);
}

const dataFile = args[0];
const templateFlag = args.indexOf('--template');
const templateFile = templateFlag !== -1
  ? args[templateFlag + 1]
  : path.join(__dirname, 'template.html');

if (!fs.existsSync(dataFile)) {
  console.error(`Data file not found: ${dataFile}`);
  process.exit(1);
}

if (!fs.existsSync(templateFile)) {
  console.error(`Template not found: ${templateFile}`);
  console.error('Run bootstrap.sh first, or create template.html in this directory.');
  process.exit(1);
}

async function build() {
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const templateSrc = fs.readFileSync(templateFile, 'utf8');

  const engine = new Liquid({
    root: path.dirname(templateFile),
    extname: '.html',
  });

  // Inject build metadata
  data._built_at = new Date().toISOString().split('T')[0];
  data._data_file = path.basename(dataFile);

  const html = await engine.parseAndRender(templateSrc, data);

  // Derive output path from data file stem
  const stem = path.basename(dataFile, path.extname(dataFile));
  const outDir = path.join(process.cwd(), 'output', stem);
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');

  console.log(`✅ Built: ${outFile}`);
  console.log(`   Serve: python3 -m http.server 8080 --directory ${outDir}`);
}

build().catch(err => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
