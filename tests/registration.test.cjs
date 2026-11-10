const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { module: 'commonjs', target: 'es2022', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
});
const { ValidationPipe } = require('@nestjs/common');
const { RegisterEmailDto } = require('../services/auth/src/auth/dto/register-email.dto.ts');
const { RegisterPhoneDto } = require('../services/auth/src/auth/dto/register-phone.dto.ts');
const { AuthService } = require('../services/auth/src/auth/auth.service.ts');

const pipe = new ValidationPipe({
  whitelist: true, forbidNonWhitelisted: true, transform: true,
  transformOptions: { enableImplicitConversion: true },
});

for (const [method, metatype, identifier] of [
  ['email', RegisterEmailDto, 'recipient@example.invalid'],
  ['phone', RegisterPhoneDto, '+2348012345678'],
]) {
  test(`${method} registration sends an OTP with an omitted, blank or whitespace-only referral`, async () => {
    const delivered = [];
    const service = new AuthService(
      { findOne: async () => null }, null, null, null,
      { sendOtp: async params => delivered.push(params) }, null, null,
    );
    for (const referral of [{}, { referralCode: '' }, { referralCode: '   ' }, { referralCode: null }]) {
      const dto = await pipe.transform({ [method]: identifier, ...referral }, { type: 'body', metatype });
      assert.ok(dto.referralCode == null);
      const response = await service[method === 'email' ? 'registerEmail' : 'registerPhone'](dto, '127.0.0.1');
      assert.equal(response.success, true);
    }
    assert.equal(delivered.length, 4);
    assert.ok(delivered.every(params => params.identifier === identifier && params.method === method && params.purpose === 'registration'));
  });

  test(`${method} registration trims supplied referral codes and retains length validation`, async () => {
    for (const referralCode of ['ABC123', 'ABCDEFGHIJ', ' ABC123 ']) {
      const dto = await pipe.transform({ [method]: identifier, referralCode }, { type: 'body', metatype });
      assert.equal(dto.referralCode, referralCode.trim());
    }
    for (const referralCode of ['12345', 'ABCDEFGHIJK', ' 12345 ']) {
      await assert.rejects(pipe.transform({ [method]: identifier, referralCode }, { type: 'body', metatype }), error => {
        assert.equal(error.getStatus(), 400);
        assert.ok(error.getResponse().message.some(message => message.includes('referralCode')));
        return true;
      });
    }
  });
}
