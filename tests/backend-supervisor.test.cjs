const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

async function unusedPorts() {
  const servers = [createServer(), createServer(), createServer()];
  await Promise.all(servers.map(server => new Promise(done => server.listen(0, '127.0.0.1', done))));
  const ports = servers.map(server => server.address().port);
  await Promise.all(servers.map(server => new Promise(done => server.close(done))));
  return ports;
}

const fixture = `
const { createServer } = require('node:http');
const { appendFileSync } = require('node:fs');
(async () => {
  if (role === 'fiat') {
    const auth = await fetch(process.env.AUTH_SERVICE_URL + '/api/v1/health');
    if (!auth.ok) process.exit(3);
  }
  const server = createServer(async (req, res) => {
    if (req.url === '/crash') { res.end('stopping'); setTimeout(() => process.exit(7), 20); return; }
    let status = 'ready';
    if (role === 'auth' && process.env.FIXTURE_MODE === 'unhealthy') status = 'starting';
    if (role === 'gateway') {
      const checks = await Promise.all([
        fetch(process.env.AUTH_SERVICE_URL + '/api/v1/health'),
        fetch(process.env.FIAT_SERVICE_URL + '/health'),
      ]);
      if (checks.some(check => !check.ok)) status = 'starting';
    }
    res.writeHead(status === 'ready' ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status, role, bind: server.address().address }));
  });
  const port = role === 'auth' ? process.env.PORT : role === 'fiat' ? process.env.FIAT_PORT : process.env.GATEWAY_PORT;
  server.listen(Number(port), process.env.SERVICE_BIND_HOST || '0.0.0.0', () => appendFileSync(process.env.FIXTURE_ORDER, role + '\\n'));
})().catch(() => process.exit(4));
`;

async function launch(t, mode = 'ready') {
  const root = await mkdtemp(join(tmpdir(), 'lightpay-supervisor-'));
  for (const role of ['auth', 'fiat', 'gateway']) {
    const folder = join(root, 'services', role, 'dist');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'main.js'), `const role = ${JSON.stringify(role)};\n${fixture}`);
  }
  const [port, authPort, fiatPort] = await unusedPorts();
  const order = join(root, 'order');
  await writeFile(order, '');
  const options = { root, port, authPort, fiatPort, startupTimeoutMs: mode === 'unhealthy' ? 700 : 6000 };
  const entry = resolve(__dirname, '../infra/start-backend.cjs');
  const child = spawn(process.execPath, ['-e', `require(${JSON.stringify(entry)}).startBackend(${JSON.stringify(options)})`], {
    env: { ...process.env, FIXTURE_ORDER: order, FIXTURE_MODE: mode },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const exited = new Promise(done => child.once('exit', (code, signal) => done({ code, signal })));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exited;
    await rm(root, { recursive: true, force: true });
  });
  return { child, exited, port, authPort, fiatPort, order, output: () => output };
}

async function ready(app) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${app.port}/api/v1/health`, { signal: AbortSignal.timeout(300) });
      if (response.ok) return await response.json();
    } catch {}
    if (app.child.exitCode !== null) break;
    await sleep(50);
  }
  assert.fail(`Backend did not become ready: ${app.output()}`);
}

async function assertStopped(port) {
  await assert.rejects(fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(300) }));
}

test('free backend waits for both upstreams, binds them locally, and shuts down after a child failure', async t => {
  const app = await launch(t);
  assert.equal((await ready(app)).status, 'ready');
  assert.deepEqual((await readFile(app.order, 'utf8')).trim().split('\n'), ['auth', 'fiat', 'gateway']);
  for (const port of [app.authPort, app.fiatPort]) {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal((await response.json()).bind, '127.0.0.1');
  }
  await fetch(`http://127.0.0.1:${app.fiatPort}/crash`);
  assert.equal((await app.exited).code, 1);
  await Promise.all([app.authPort, app.fiatPort, app.port].map(assertStopped));
});

test('unready auth prevents fiat and the public gateway from starting', async t => {
  const app = await launch(t, 'unhealthy');
  assert.equal((await app.exited).code, 1);
  assert.equal((await readFile(app.order, 'utf8')).trim(), 'auth');
  await Promise.all([app.authPort, app.fiatPort, app.port].map(assertStopped));
});

test('Render termination stops all backend processes cleanly', async t => {
  const app = await launch(t);
  await ready(app);
  app.child.kill('SIGTERM');
  assert.equal((await app.exited).code, 0);
  await Promise.all([app.authPort, app.fiatPort, app.port].map(assertStopped));
});
