import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const envFile = resolve(root, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const environment = {
  ...process.env,
  FIREBASE_PROJECT_ID: 'demo-agenthub',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
};
const children = new Set();

function start(command, args, label) {
  const child = spawn(command, args, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    shell: isWindows,
  });
  children.add(child);
  child.once('exit', (code) => {
    children.delete(child);
    if (code !== 0 && code !== null) {
      console.error(`${label} exited with code ${code}.`);
      stopChildren();
    }
  });
  return child;
}

function stopChildren() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
  children.clear();
}

async function waitForEmulator(url, emulator) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (emulator.exitCode !== null) {
      throw new Error('Firebase emulators stopped before becoming ready.');
    }
    try {
      await fetch(url);
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function runSeed() {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [resolve(root, 'tools/seed-emulator.mjs')], {
      cwd: root,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', rejectPromise);
    child.once('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Demo seed exited with code ${code}.`));
      }
    });
  });
}

process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);

try {
  const emulators = start(npm, ['run', 'start:emulators'], 'Firebase emulators');
  await waitForEmulator('http://127.0.0.1:9099/', emulators);
  await waitForEmulator('http://127.0.0.1:8080/', emulators);
  await runSeed();
  start(npm, ['run', 'api:dev'], 'API');
  start(npm, ['run', 'dashboard:dev'], 'Dashboard');
  console.log('Agent Hub is starting. Dashboard: http://localhost:4200, API: http://localhost:3000/api/v1');
} catch (error) {
  stopChildren();
  console.error(error);
  process.exitCode = 1;
}
