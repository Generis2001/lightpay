const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { module: 'commonjs', target: 'es2022', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
});
const express = require('express');
const { OtpService } = require('../services/auth/src/otp/otp.service.ts');

function store() {
  const state = { challenge: null, deleted: [] };
  const repo = {
    create: value => ({ ...value }),
    save: async value => { state.challenge = { ...value }; return value; },
    delete: async where => {
      state.deleted.push(where);
      if (state.challenge?.key === where.key && state.challenge.codeHash === where.codeHash) state.challenge = null;
    },
    manager: {
      transaction: async callback => callback({
        findOne: async (_entity, { where }) => state.challenge?.key === where.key ? state.challenge : null,
        save: async (_entity, value) => { state.challenge = { ...value }; return value; },
      }),
    },
  };
  return { state, repo };
}

function config(values = {}) {
  const settings = {
    'app.jwtSecret': 'isolated-otp-regression-secret-never-used-in-production',
    'app.fromEmail': 'sender@example.invalid',
    ...values,
  };
  return {
    get: name => settings[name],
    getOrThrow: name => {
      if (!settings[name]) throw new Error('Missing fixture configuration');
      return settings[name];
    },
  };
}

async function providerFixture(handler, run) {
  const app = express();
  app.use(express.json());
  app.post('/v3/smtp/email', handler);
  app.post('/v3/mail/send', handler);
  app.post('/api/sms/send', handler);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const originalFetch = global.fetch;
  const url = `http://127.0.0.1:${server.address().port}`;
  global.fetch = (target, options) => {
    assert.ok(['https://api.brevo.com/v3/smtp/email', 'https://api.sendgrid.com/v3/mail/send', 'https://api.ng.termii.com/api/sms/send'].includes(target));
    assert.equal(options.method, 'POST');
    assert.ok(options.signal instanceof AbortSignal);
    return originalFetch(`${url}${new URL(target).pathname}`, options);
  };
  try {
    await run();
  } finally {
    global.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
  }
}

test('Brevo email OTP follows the API contract and produces a persisted single-use code', async () => {
  let delivery;
  const database = store();
  const service = new OtpService(config({ 'app.brevoApiKey': 'isolated-brevo-fixture-key', 'app.otpExpirySeconds': 90 }), database.repo);
  const request = { identifier: 'recipient@example.invalid', method: 'email', purpose: 'registration' };
  await providerFixture((req, res) => {
    assert.equal(req.path, '/v3/smtp/email');
    assert.equal(req.headers['api-key'], 'isolated-brevo-fixture-key');
    assert.equal(req.headers.authorization, undefined);
    delivery = req.body;
    res.status(201).json({ messageId: '<isolated-test-message@example.invalid>' });
  }, async () => {
    const started = Date.now();
    await service.sendOtp(request);
    assert.deepEqual(delivery.sender, { email: 'sender@example.invalid', name: 'LightPay' });
    assert.deepEqual(delivery.to, [{ email: request.identifier }]);
    assert.equal(delivery.subject, 'Verify your LightPay account');
    assert.match(delivery.textContent, /expires in 90 seconds/);
    const code = delivery.textContent.match(/verification code is: (\d{6})/)[1];
    assert.notEqual(database.state.challenge.codeHash, code);
    assert.equal(database.state.challenge.code, undefined);
    assert.ok(database.state.challenge.expiresAt.getTime() >= started + 90000);
    await service.verifyOtp({ ...request, code });
    assert.ok(database.state.challenge.usedAt instanceof Date);
    await assert.rejects(service.verifyOtp({ ...request, code }), /already used/);
  });
});

test('email OTP delivery and verification share one identity regardless of email case or surrounding spaces', async () => {
  const database = store();
  const service = new OtpService(config({ 'app.brevoApiKey': 'isolated-brevo-fixture-key' }), database.repo);
  let code;
  await providerFixture((req, res) => {
    assert.deepEqual(req.body.to, [{ email: 'recipient+live-test@example.invalid' }]);
    code = req.body.textContent.match(/verification code is: (\d{6})/)[1];
    res.status(201).json({ messageId: '<case-regression@example.invalid>' });
  }, async () => {
    await service.sendOtp({ identifier: ' Recipient+LIVE-Test@Example.Invalid ', method: 'email', purpose: 'registration' });
    await service.verifyOtp({ identifier: 'RECIPIENT+live-test@example.INVALID', method: 'email', purpose: 'registration', code });
    assert.ok(database.state.challenge.usedAt instanceof Date);
    await assert.rejects(service.verifyOtp({ identifier: 'recipient+live-test@example.invalid', method: 'email', purpose: 'registration', code }), /already used/);
  });
});

test('email provider rejection, quota exhaustion and missing acknowledgement invalidate the issued challenge', async t => {
  for (const failure of [
    { name: 'invalid credentials', status: 401, body: { message: 'private provider details' } },
    { name: 'daily quota', status: 429, body: { message: 'quota exhausted' } },
    { name: 'provider unavailable', status: 503, body: { message: 'unavailable' } },
    { name: 'missing acknowledgement', status: 201, body: {} },
    { name: 'null acknowledgement', status: 201, body: null },
    { name: 'invalid message identifiers', status: 201, body: { messageId: 42, messageIds: [null, 42, ' '] } },
  ]) {
    await t.test(failure.name, async () => {
      const database = store();
      const service = new OtpService(config({ 'app.emailProvider': 'brevo', 'app.brevoApiKey': 'isolated-brevo-fixture-key' }), database.repo);
      await providerFixture((_req, res) => res.status(failure.status).json(failure.body), async () => {
        await assert.rejects(service.sendOtp({ identifier: 'recipient@example.invalid', method: 'email', purpose: 'login' }), error => {
          assert.equal(error.getStatus(), 503);
          assert.match(error.message, /Unable to send your verification code/);
          assert.doesNotMatch(error.message, /private provider details/);
          return true;
        });
        assert.equal(database.state.challenge, null);
        assert.equal(database.state.deleted.length, 1);
        assert.match(database.state.deleted[0].codeHash, /^[a-f0-9]{64}$/);
      });
    });
  }
});

test('a provider network failure removes the challenge and returns a usable delivery error', async () => {
  const database = store();
  const service = new OtpService(config({ 'app.emailProvider': 'brevo', 'app.brevoApiKey': 'isolated-brevo-fixture-key' }), database.repo);
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('isolated network failure'); };
  try {
    await assert.rejects(service.sendOtp({ identifier: 'recipient@example.invalid', method: 'email', purpose: 'login' }), /Unable to send your verification code/);
    assert.equal(database.state.challenge, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test('missing email credentials or sender configuration cannot leave a usable challenge', async t => {
  for (const values of [
    { 'app.emailProvider': 'brevo' },
    { 'app.emailProvider': 'brevo', 'app.brevoApiKey': 'isolated-brevo-fixture-key', 'app.fromEmail': '' },
    { 'app.emailProvider': 'unknown-provider', 'app.brevoApiKey': 'isolated-brevo-fixture-key' },
  ]) {
    await t.test(JSON.stringify(Object.keys(values)), async () => {
      const database = store();
      const service = new OtpService(config(values), database.repo);
      await assert.rejects(service.sendOtp({ identifier: 'recipient@example.invalid', method: 'email', purpose: 'login' }), /not configured/);
      assert.equal(database.state.challenge, null);
    });
  }
});

test('existing SendGrid configuration still accepts HTTP 202 and rejects delivery failures', async () => {
  const database = store();
  const service = new OtpService(config({ 'app.sendgridApiKey': 'isolated-sendgrid-fixture-key' }), database.repo);
  let status = 202;
  await providerFixture((req, res) => {
    assert.equal(req.path, '/v3/mail/send');
    assert.equal(req.headers.authorization, 'Bearer isolated-sendgrid-fixture-key');
    assert.equal(req.headers['api-key'], undefined);
    assert.equal(req.body.subject, 'Reset your LightPay PIN');
    assert.deepEqual(req.body.personalizations, [{ to: [{ email: 'recipient@example.invalid' }] }]);
    assert.match(req.body.content[0].value, /expires in 5 minutes/);
    res.status(status).end();
  }, async () => {
    const request = { identifier: 'recipient@example.invalid', method: 'email', purpose: 'reset_pin' };
    await service.sendOtp(request);
    assert.ok(database.state.challenge);
    status = 429;
    await assert.rejects(service.sendOtp(request), /Unable to send your verification code/);
    assert.equal(database.state.challenge, null);
  });
});

test('Termii SMS uses the configured sender and only accepts acknowledged sends', async () => {
  const database = store();
  const service = new OtpService(config({ 'app.termiiApiKey': 'isolated-termii-fixture-key', 'app.termiiSenderId': 'Approved' }), database.repo);
  let code;
  await providerFixture((req, res) => {
    assert.equal(req.path, '/api/sms/send');
    assert.equal(req.body.to, '2348012345678');
    assert.equal(req.body.from, 'Approved');
    assert.equal(req.body.channel, 'dnd');
    assert.equal(req.body.api_key, 'isolated-termii-fixture-key');
    code = req.body.sms.match(/verification code is: (\d{6})/)[1];
    res.json({ code: 'ok', message_id: 'isolated-sms-message', message: 'Successfully Sent' });
  }, async () => {
    const request = { identifier: '+2348012345678', method: 'phone', purpose: 'registration' };
    await service.sendOtp(request);
    await service.verifyOtp({ ...request, code });
    await assert.rejects(service.verifyOtp({ ...request, code }), /already used/);
  });
});

test('SMS rejection and missing acknowledgement remove the issued code', async t => {
  for (const failure of [
    { name: 'invalid credentials', status: 401, body: { message: 'private provider details' } },
    { name: 'quota exhaustion', status: 429, body: {} },
    { name: 'missing acknowledgement', status: 200, body: {} },
    { name: 'null acknowledgement', status: 200, body: null },
    { name: 'application rejection', status: 200, body: { code: 'failed', message_id: 'failed-message' } },
  ]) {
    await t.test(failure.name, async () => {
      const database = store();
      const service = new OtpService(config({ 'app.termiiApiKey': 'isolated-termii-fixture-key' }), database.repo);
      await providerFixture((_req, res) => res.status(failure.status).json(failure.body), async () => {
        await assert.rejects(service.sendOtp({ identifier: '+2348012345678', method: 'phone', purpose: 'registration' }), error => {
          assert.equal(error.getStatus(), 503);
          assert.match(error.message, /use email/);
          assert.doesNotMatch(error.message, /private provider details/);
          return true;
        });
        assert.equal(database.state.challenge, null);
      });
    });
  }
});

test('SMS network failure or timeout invalidates the challenge', async () => {
  const database = store();
  const service = new OtpService(config({ 'app.termiiApiKey': 'isolated-termii-fixture-key' }), database.repo);
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new DOMException('Fixture timeout', 'TimeoutError'); };
  try {
    await assert.rejects(service.sendOtp({ identifier: '+2348012345678', method: 'phone', purpose: 'registration' }), /use email/);
    assert.equal(database.state.challenge, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test('missing SMS credentials give an email fallback and leave no usable code', async () => {
  const database = store();
  const service = new OtpService(config(), database.repo);
  await assert.rejects(service.sendOtp({ identifier: '+2348012345678', method: 'phone', purpose: 'registration' }), /Phone verification is currently unavailable. Please use email/);
  assert.equal(database.state.challenge, null);
});
