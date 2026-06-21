/* Materialisiert die Toolkit-Skripte aus data/toolkit.js in den Ordner tools/.
 * Damit liegen sie einzeln auf dem USB-Stick bereit.  node tools/export-tools.js
 */
'use strict';
var fs = require('fs'), path = require('path');
require('../js/core.js');
require('../data/toolkit.js');

var dir = __dirname;
(globalThis.IR.toolkit || []).forEach(function (t) {
  var p = path.join(dir, t.filename);
  fs.writeFileSync(p, t.script);
  if (/\.(sh|py)$/.test(t.filename)) { try { fs.chmodSync(p, 0o755); } catch (e) {} }
  console.log('wrote', path.relative(path.join(dir, '..'), p));
});
