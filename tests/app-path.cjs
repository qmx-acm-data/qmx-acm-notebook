'use strict';
const path = require('node:path');

// Runtime tests exercise the same built application used by development and packaging.
// An explicit app root also lets smoke tests target an unpacked application fixture.
function appPath(relative) {
  return path.resolve(process.env.QMX_APP_ROOT || path.join(__dirname, '..', 'build', 'app'), relative);
}

module.exports = { appPath };
