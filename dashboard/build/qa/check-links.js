#!/usr/bin/env node
/**
 * Link Checker
 * 
 * Validates all internal links in generated HTML:
 * - No 404s (broken links to runs/models)
 * - All referenced files exist
 * - Relative paths are correct
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUBLISHED_DIR = path.join(__dirname, '../../published');

let totalLinks = 0;
let brokenLinks = [];
let checkedFiles = new Set();

function extractLinks(html) {
  const linkPattern = /href="([^"]+)"/g;
  const links = [];
  let match;
  
  while ((match = linkPattern.exec(html)) !== null) {
    const link = match[1];
    // Skip external links and anchors
    if (!link.startsWith('http') && !link.startsWith('#') && !link.startsWith('mailto:')) {
      links.push(link);
    }
  }
  
  return links;
}

function resolvePath(fromFile, link) {
  const dir = path.dirname(fromFile);
  return path.normalize(path.join(dir, link));
}

function checkLink(fromFile, link) {
  totalLinks++;
  
  let targetPath = resolvePath(fromFile, link);
  
  // Remove hash if present
  const hashIndex = targetPath.indexOf('#');
  if (hashIndex !== -1) {
    targetPath = targetPath.substring(0, hashIndex);
  }
  
  // If it ends with /, add index.html
  if (targetPath.endsWith('/')) {
    targetPath = path.join(targetPath, 'index.html');
  }
  
  if (!fs.existsSync(targetPath)) {
    brokenLinks.push({
      file: path.relative(PUBLISHED_DIR, fromFile),
      link,
      resolved: path.relative(PUBLISHED_DIR, targetPath)
    });
    return false;
  }
  
  return true;
}

function checkFile(filePath) {
  if (checkedFiles.has(filePath)) return;
  checkedFiles.add(filePath);
  
  const html = fs.readFileSync(filePath, 'utf8');
  const links = extractLinks(html);
  
  links.forEach(link => checkLink(filePath, link));
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file === 'index.html') {
      checkFile(fullPath);
    }
  });
}

function main() {
  console.log('🔍 Link Checker\n');
  
  console.log(`Checking links in ${PUBLISHED_DIR}\n`);
  
  // Check main dashboard
  const mainDashboard = path.join(PUBLISHED_DIR, 'index.html');
  if (fs.existsSync(mainDashboard)) {
    checkFile(mainDashboard);
  }
  
  // Check all run pages
  const runsDir = path.join(PUBLISHED_DIR, 'runs');
  if (fs.existsSync(runsDir)) {
    walkDir(runsDir);
  }
  
  // Check all model pages
  const modelsDir = path.join(PUBLISHED_DIR, 'models');
  if (fs.existsSync(modelsDir)) {
    walkDir(modelsDir);
  }
  
  console.log('='.repeat(60));
  console.log('');
  
  console.log(`Total Links Checked: ${totalLinks}`);
  console.log(`Files Checked: ${checkedFiles.size}\n`);
  
  if (brokenLinks.length === 0) {
    console.log('✅ No broken links found!\n');
  } else {
    console.log(`❌ BROKEN LINKS (${brokenLinks.length}):\n`);
    brokenLinks.forEach(link => {
      console.log(`  ${link.file}`);
      console.log(`  → "${link.link}" → ${link.resolved} (NOT FOUND)\n`);
    });
  }
  
  console.log('='.repeat(60));
  console.log('');
  
  process.exit(brokenLinks.length > 0 ? 1 : 0);
}

main();
