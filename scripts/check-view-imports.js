const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (/\.(js|jsx|ts|tsx)$/.test(file)) results.push(file);
    }
  });
  return results;
}

const root = path.resolve(__dirname, '..');
const files = walk(root);
let problems = [];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.indexOf('<View') !== -1) {
    const importLines = content.split(/\r?\n/).slice(0, 40).join('\n');
    const hasViewImport = /from\s+['\"]react-native['\"]/m.test(importLines) && /\bView\b/.test(importLines);
    if (!hasViewImport) {
      problems.push({ file: f, reason: 'contains <View> but no import { View } from react-native in top 40 lines' });
    }
  }
});

if (problems.length === 0) {
  console.log('No problems found: every file that uses <View> has a View import in top 40 lines.');
  process.exit(0);
} else {
  console.log('Potential issues:');
  problems.forEach(p => console.log('-', p.file, '\n  ', p.reason));
  process.exit(1);
}
