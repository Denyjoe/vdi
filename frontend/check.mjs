import { parse } from 'espree';
import fs from 'fs';

const code = fs.readFileSync('src/pages/admin/AdminSettingsPage.jsx', 'utf8');

const ast = parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
});

const declared = new Set(['console', 'window', 'localStorage', 'document', 'URL', 'Date', 'JSON', 'setTimeout', 'Promise', 'Array', 'String', 'Object', 'Boolean', 'Number', 'alert']);
const used = new Set();

function walk(node) {
    if (!node) return;
    if (node.type === 'Identifier') {
        used.add(node.name);
    }
    if (node.type === 'VariableDeclarator') {
        if (node.id.type === 'Identifier') declared.add(node.id.name);
        if (node.id.type === 'ArrayPattern') {
            node.id.elements.forEach(e => {
                if (e && e.type === 'Identifier') declared.add(e.name);
            });
        }
        if (node.id.type === 'ObjectPattern') {
            node.id.properties.forEach(p => {
                if (p.value && p.value.type === 'Identifier') declared.add(p.value.name);
            });
        }
    }
    if (node.type === 'FunctionDeclaration' && node.id) {
        declared.add(node.id.name);
    }
    if (node.type === 'ImportDeclaration') {
        node.specifiers.forEach(s => {
            if (s.local) declared.add(s.local.name);
        });
    }

    // Traverse children
    for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
            if (Array.isArray(node[key])) {
                node[key].forEach(walk);
            } else {
                walk(node[key]);
            }
        }
    }
}

walk(ast);

for (const name of used) {
    if (!declared.has(name)) {
        console.log('Potentially undefined:', name);
    }
}
