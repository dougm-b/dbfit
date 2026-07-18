#!/usr/bin/env node
// Assembles src/shell.html + src/** fragments into a single index.html.
// Run after editing anything under src/: `node build.js`
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

// One entry per output page: { shell: 'src/<file>', out: '<repo-root file>' }
const TARGETS = [
  { shell: 'shell.html', out: 'index.html' },
  { shell: 'detail-shell.html', out: 'detail.html' },
];

const INCLUDE_RE = /<!--INCLUDE:([^\s]+?)-->/g;

function resolveIncludes(text, seen) {
  return text.replace(INCLUDE_RE, (match, relPath) => {
    const filePath = path.join(SRC, relPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`build.js: included file not found: src/${relPath} (referenced as ${match})`);
    }
    if (seen.has(filePath)) {
      throw new Error(`build.js: circular include detected for src/${relPath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return resolveIncludes(content, new Set(seen).add(filePath));
  });
}

function build() {
  TARGETS.forEach(({ shell, out }) => {
    const shellPath = path.join(SRC, shell);
    const outPath = path.join(ROOT, out);
    const shellText = fs.readFileSync(shellPath, 'utf8');
    const html = resolveIncludes(shellText, new Set([shellPath]));
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Built ${out} (${html.length} bytes) from src/${shell}`);
  });
}

build();
