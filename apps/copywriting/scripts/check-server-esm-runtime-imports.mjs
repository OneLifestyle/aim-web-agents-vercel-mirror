import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryFile = path.join(appRoot, 'api', 'copywriting.ts');
const explicitRuntimeExtensions = new Set(['.js', '.mjs', '.cjs', '.json', '.node']);

const isRelativeSpecifier = (specifier) => specifier.startsWith('./') || specifier.startsWith('../');

const collectRuntimeSpecifiers = (sourceFile) => {
  const emitted = ts.transpileModule(sourceFile.text, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceFile.fileName,
  }).outputText;
  const emittedFile = ts.createSourceFile(
    sourceFile.fileName.replace(/\.[cm]?tsx?$/u, '.js'),
    emitted,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  const specifiers = [];

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };

  visit(emittedFile);
  return specifiers.filter(isRelativeSpecifier);
};

const sourceCandidatesFor = (importer, specifier) => {
  const resolved = path.resolve(path.dirname(importer), specifier);
  const extension = path.extname(specifier);

  if (extension === '.js') {
    return [resolved, resolved.slice(0, -3) + '.ts', resolved.slice(0, -3) + '.tsx'];
  }
  if (extension === '.mjs') return [resolved, resolved.slice(0, -4) + '.mts'];
  if (extension === '.cjs') return [resolved, resolved.slice(0, -4) + '.cts'];
  if (extension) return [resolved];

  return [
    resolved + '.ts',
    resolved + '.tsx',
    resolved + '.mts',
    resolved + '.cts',
    resolved + '.js',
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
    path.join(resolved, 'index.js'),
  ];
};

const resolveLocalSource = (importer, specifier) => (
  sourceCandidatesFor(importer, specifier).find(candidate => fs.existsSync(candidate)) ?? null
);

const relativeName = (file) => path.relative(appRoot, file).split(path.sep).join('/');
const queue = [entryFile];
const visited = new Set();
const edges = [];
const failures = [];

while (queue.length > 0) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);

  const sourceFile = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  for (const specifier of collectRuntimeSpecifiers(sourceFile)) {
    const target = resolveLocalSource(file, specifier);
    edges.push(`${relativeName(file)} -> ${specifier}`);

    if (!explicitRuntimeExtensions.has(path.extname(specifier))) {
      failures.push(`${relativeName(file)} uses extensionless local runtime import ${JSON.stringify(specifier)}`);
    }
    if (!target) {
      failures.push(`${relativeName(file)} cannot resolve local runtime import ${JSON.stringify(specifier)}`);
      continue;
    }
    if (target !== appRoot && !target.startsWith(appRoot + path.sep)) {
      failures.push(`${relativeName(file)} imports outside the Copywriting app: ${JSON.stringify(specifier)}`);
      continue;
    }
    if (/\.[cm]?[jt]sx?$/u.test(target)) queue.push(target);
  }
}

if (failures.length > 0) {
  console.error('Copywriting server runtime ESM check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Copywriting server runtime ESM check passed (${visited.size} modules, ${edges.length} local runtime edges).`);
}

for (const edge of edges.sort()) console.log(`- ${edge}`);
