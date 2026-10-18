const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const { repoRoot, repoPath } = require('./paths.cjs');

function reportDirectory(name, argument) {
  const directory = repoPath(argument || `work/verification/${name}`);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

async function launchBrowser(options = {}) {
  const base = { headless: true, ...options };
  const bundled = chromium.executablePath();
  if (fs.existsSync(bundled)) return chromium.launch(base);
  const configured = process.env.CHROME_EXECUTABLE_PATH;
  if (configured) {
    if (!fs.existsSync(configured)) throw new Error('CHROME_EXECUTABLE_PATH does not point to a browser executable.');
    return chromium.launch({ ...base, executablePath: configured });
  }
  // The bundled Playwright browser is preferred. Installed Chrome/Edge are
  // convenient fallbacks on machines that have not downloaded it yet.
  const candidates = process.platform === 'win32' ? [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ] : [ '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome' ];
  const executablePath = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (executablePath) return chromium.launch({ ...base, executablePath });
  throw new Error('No browser found. Run npm run setup:browser or set CHROME_EXECUTABLE_PATH.');
}

module.exports = { repoRoot, repoPath, reportDirectory, launchBrowser };
