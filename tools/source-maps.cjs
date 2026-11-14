'use strict';
const path = require('node:path');

// Keep emit options explicit so release output stays independent of tsconfig map settings.
function sourceMapOptions(enabled = false) {
  return { sourceMap: enabled, inlineSourceMap: false, inlineSources: enabled, sourceRoot: undefined, mapRoot: undefined };
}

function stripSourceMapComment(text) {
  return text.replace(/\r\n/g, '\n').replace(/^\/\/# sourceMappingURL=.*(?:\n|$)/gm, '');
}

// Relocate a TypeScript emit without emitting JavaScript a second time. The generated
// header occupies unmapped lines; map sources resolve from the staged map, not src/.
function generatedOutput({ root, target, header, text, mapText, mapName, outputRoot = path.join(root, 'build/app') }) {
  const release = header + stripSourceMapComment(text);
  if (mapText === undefined) return new Map([[target, release]]);
  if (!mapName) throw new Error(`Missing emitted map filename for ${target}`);
  const map = JSON.parse(mapText);
  const mapTarget = target + '.map';
  const destination = path.dirname(path.join(outputRoot, mapTarget));
  const sourceRoot = path.resolve(path.dirname(mapName), map.sourceRoot || '');
  map.file = path.basename(target);
  map.sources = map.sources.map(source => path.relative(destination, path.resolve(sourceRoot, source)).replaceAll('\\', '/'));
  delete map.sourceRoot;
  map.mappings = ';'.repeat((header.match(/\n/g) || []).length) + map.mappings;
  return new Map([
    [target, release + `//# sourceMappingURL=${path.basename(mapTarget)}\n`],
    [mapTarget, JSON.stringify(map) + '\n']
  ]);
}

module.exports = { sourceMapOptions, stripSourceMapComment, generatedOutput };
