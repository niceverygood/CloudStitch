const path = require('node:path');
const repoRoot = path.resolve(__dirname, '..', '..');
const repoPath = value => path.resolve(repoRoot, value);
module.exports = { repoRoot, repoPath };
