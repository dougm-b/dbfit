#!/usr/bin/env node
// Assembles src/shell.html + src/** fragments into a single index.html.
// Run after editing anything under src/: `node build.js`
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const SHELL = path.join(SRC, 'shell.html');
const OUT = path.join(ROOT, 'index.html');

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
  const shell = fs.readFileSync(SHELL, 'utf8');
  const html = resolveIncludes(shell, new Set([SHELL]));
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Built index.html (${html.length} bytes) from src/shell.html`);
}

build();
