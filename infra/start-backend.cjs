const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

function startBackend({
  root = resolve(__dirname, '..'),
  port = Number(process.env.PORT || 10000),
  authPort = 3001,
  fiatPort = 3002,
  startupTimeoutMs = 180000,
} = {}) {
  const ports = [port, authPort, fiatPort];
  if (ports.some(p => !Number.isInteger(p) || p < 1 || p > 65535) || new Set(ports).size !== 3) {
    throw new Error('Backend ports must be distinct valid TCP ports');
  }
  const children = [];
  let stopping = false;
  const shared = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    AUTH_SERVICE_URL: `http://127.0.0.1:${authPort}`,
    FIAT_SERVICE_URL: `http://127.0.0.1:${fiatPort}`,
  };

  function stop(code) {
    if (stopping) return;
    stopping = true;
    for (const entry of children) {
      if (entry.child.exitCode === null && entry.child.signalCode === null) entry.child.kill('SIGTERM');
    }
    const deadline = setTimeout(() => {
      for (const entry of children) {
        if (entry.child.exitCode === null && entry.child.signalCode === null) entry.child.kill('SIGKILL');
      }
      process.exit(code);
    }, 5000);
    Promise.all(children.map(entry => entry.done)).then(() => {
      clearTimeout(deadline);
      process.exit(code);
    });
  }

  function launch(name, heapMb, env) {
    const child = spawn(process.execPath, [`--max-old-space-size=${heapMb}`, 'dist/main.js'], {
      cwd: resolve(root, 'services', name),
      env: { ...shared, ...env },
      stdio: 'inherit',
    });
    const done = new Promise(resolveDone => {
      child.once('exit', (code, signal) => {
        resolveDone();
        if (!stopping) {
          console.error(`${name} stopped (${signal || code}); restarting the backend container is required.`);
          stop(1);
        }
      });
      child.once('error', () => {
        resolveDone();
        console.error(`Could not start ${name}.`);
        stop(1);
      });
    });
    children.push({ child, done });
  }

  async function waitReady(name, url) {
    const deadline = Date.now() + startupTimeoutMs;
    while (!stopping && Date.now() < deadline) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (response.ok && (await response.json()).status === 'ready') {
          console.log(`${name} is ready.`);
          return;
        }
      } catch { /* Migrations and listeners may still be starting. */ }
      await sleep(500);
    }
    throw new Error(`${name} did not become ready before startup timed out.`);
  }

  process.once('SIGTERM', () => stop(0));
  process.once('SIGINT', () => stop(0));
  const ready = (async () => {
    launch('auth', 96, { PORT: String(authPort), SERVICE_BIND_HOST: '127.0.0.1' });
    await waitReady('auth', `${shared.AUTH_SERVICE_URL}/api/v1/health`);
    launch('fiat', 160, { FIAT_PORT: String(fiatPort), SERVICE_BIND_HOST: '127.0.0.1' });
    await waitReady('fiat', `${shared.FIAT_SERVICE_URL}/health`);
    launch('gateway', 64, { GATEWAY_PORT: String(port) });
    await waitReady('gateway', `http://127.0.0.1:${port}/api/v1/health`);
    console.log(`Lightpay backend is ready on port ${port}.`);
  })().catch(error => {
    console.error(error.message);
    stop(1);
  });
  return { ready, stop };
}

if (require.main === module) startBackend();
module.exports = { startBackend };
