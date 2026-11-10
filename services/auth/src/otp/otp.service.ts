import { Injectable, BadRequestException, UnprocessableEntityException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtpChallenge } from './otp.entity';
import * as crypto from 'crypto';

interface SendOtpParams {
  identifier: string;
  method: 'phone' | 'email';
  purpose: string;
}

interface VerifyOtpParams {
  identifier: string;
  method: 'phone' | 'email';
  code: string;
  purpose: string;
}

@Injectable()
export class OtpService {
  constructor(private readonly config: ConfigService, @InjectRepository(OtpChallenge) private readonly challenges: Repository<OtpChallenge>) {}

  private identifier(params: SendOtpParams) { return params.method === 'email' ? params.identifier.trim().toLowerCase() : params.identifier; }
  private key(params: SendOtpParams) { return crypto.createHash('sha256').update(`${params.method}:${this.identifier(params)}:${params.purpose}`).digest('hex'); }
  private codeHash(key: string, code: string) { return crypto.createHmac('sha256', this.config.getOrThrow<string>('app.jwtSecret')).update(`${key}:${code}`).digest('hex'); }

  async sendOtp(params: SendOtpParams): Promise<void> {
    params = { ...params, identifier: this.identifier(params) };
    const code = this.generateCode(); const key = this.key(params);
    const expirySeconds = this.config.get<number>('app.otpExpirySeconds') ?? 300;
    const challenge = this.challenges.create({ key, codeHash: this.codeHash(key, code), expiresAt: new Date(Date.now() + expirySeconds * 1000), attempts: 0, usedAt: null });
    await this.challenges.save(challenge);
    try {
      if (params.method === 'phone') await this.sendSms(params.identifier, code);
      else await this.sendEmail(params.identifier, code, params.purpose);
    } catch (error) {
      await this.challenges.delete({ key, codeHash: challenge.codeHash });
      throw error;
    }
  }

  async verifyOtp(params: VerifyOtpParams): Promise<void> {
    const key = this.key(params);
    const result = await this.challenges.manager.transaction(async (manager) => {
      const record = await manager.findOne(OtpChallenge, { where: { key }, lock: { mode: 'pessimistic_write' } });
      if (!record || record.usedAt || record.expiresAt <= new Date()) return 'expired';
      const max = this.config.get<number>('app.otpMaxAttempts') ?? 5;
      if (record.attempts >= max) return 'locked';
      const expected = Buffer.from(record.codeHash, 'hex');
      const actual = Buffer.from(this.codeHash(key, params.code), 'hex');
      if (!crypto.timingSafeEqual(expected, actual)) {
        record.attempts++; await manager.save(OtpChallenge, record); return 'invalid';
      }
      record.usedAt = new Date(); await manager.save(OtpChallenge, record); return 'verified';
    });
    if (result === 'expired') throw new BadRequestException({ code: 'OTP_EXPIRED', message: 'OTP expired or already used. Request a new code.' });
    if (result === 'locked') throw new BadRequestException({ code: 'OTP_MAX_ATTEMPTS', message: 'Too many attempts. Request a new code.' });
    if (result === 'invalid') throw new UnprocessableEntityException({ code: 'OTP_INVALID', message: 'Incorrect verification code.' });
  }

  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('app.termiiApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Phone verification is currently unavailable. Please use email to continue.');
    }

    try {
      const baseUrl = new URL(this.config.get<string>('app.termiiBaseUrl')?.trim() || 'https://v4.api.termii.com');
      if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password) {
        throw new Error('Invalid SMS provider URL');
      }
      const response = await fetch(new URL('/api/sms/send', baseUrl).toString(), {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone.replace(/^\+/, ''),
          from: this.config.get<string>('app.termiiSenderId')?.trim() || 'LightPay',
          sms: `Your LightPay verification code is: ${code}. Valid for 5 minutes. Never share this code.`,
          type: 'plain',
          channel: 'dnd',
          api_key: apiKey,
        }),
      });
      if (!response.ok) {
        const rejection: unknown = await response.json();
        if (rejection && typeof rejection === 'object') {
          const details = rejection as { code?: unknown; message?: unknown };
          if (details.code === 'SENDER_ID_NOT_APPROVED' ||
              (typeof details.message === 'string' && details.message.includes('SENDER_ID_NOT_APPROVED'))) {
            throw new ServiceUnavailableException('Phone verification is awaiting activation. Please use email to continue.');
          }
        }
        throw new Error('SMS delivery was rejected');
      }
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object') throw new Error('SMS delivery was not acknowledged');
      const acknowledgement = result as { message_id?: unknown; code?: unknown };
      if (typeof acknowledgement.message_id !== 'string' || !acknowledgement.message_id.trim() ||
          (acknowledgement.code !== undefined && acknowledgement.code !== 'ok')) {
        throw new Error('SMS delivery was not acknowledged');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Unable to send your SMS verification code. Please try again or use email.');
    }
  }

  private async sendEmail(email: string, code: string, purpose: string): Promise<void> {
    const provider = this.config.get<string>('app.emailProvider') ??
      (this.config.get<string>('app.brevoApiKey') ? 'brevo' : 'sendgrid');
    if (provider !== 'brevo' && provider !== 'sendgrid') {
      throw new ServiceUnavailableException('Email provider not configured');
    }
    const apiKey = this.config.get<string>(provider === 'brevo' ? 'app.brevoApiKey' : 'app.sendgridApiKey')?.trim();
    const fromEmail = this.config.get<string>('app.fromEmail')?.trim();
    if (!apiKey || !fromEmail) {
      throw new ServiceUnavailableException('Email provider or sender not configured');
    }

    const subjects: Record<string, string> = {
      registration: 'Verify your LightPay account',
      login: 'Your LightPay login code',
      transaction: 'Authorise your LightPay transaction',
      reset_pin: 'Reset your LightPay PIN',
    };

    const expirySeconds = this.config.get<number>('app.otpExpirySeconds') ?? 300;
    const validity = expirySeconds % 60 === 0
      ? `${expirySeconds / 60} ${expirySeconds === 60 ? 'minute' : 'minutes'}`
      : `${expirySeconds} seconds`;
    const text = `Your LightPay verification code is: ${code}\n\nThis code expires in ${validity}. Never share this code with anyone.`;
    const subject = subjects[purpose] ?? 'Your LightPay code';
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    headers[provider === 'brevo' ? 'api-key' : 'Authorization'] = provider === 'brevo' ? apiKey : `Bearer ${apiKey}`;
    const body = provider === 'brevo' ? {
      sender: { email: fromEmail, name: 'LightPay' },
      to: [{ email }],
      subject,
      textContent: text,
      tags: ['lightpay-otp'],
    } : {
        personalizations: [{ to: [{ email }] }],
        from: { email: fromEmail, name: 'LightPay' },
        subject,
        content: [{ type: 'text/plain', value: text }],
    };

    try {
      const response = await fetch(provider === 'brevo'
        ? 'https://api.brevo.com/v3/smtp/email'
        : 'https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Email delivery was rejected');
      if (provider === 'brevo') {
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object') {
          throw new Error('Email delivery was not acknowledged');
        }
        const acknowledgement = result as { messageId?: unknown; messageIds?: unknown };
        const messageIds = [acknowledgement.messageId,
          ...(Array.isArray(acknowledgement.messageIds) ? acknowledgement.messageIds : [])];
        if (!messageIds.some(id => typeof id === 'string' && id.trim())) {
          throw new Error('Email delivery was not acknowledged');
        }
      }
    } catch {
      throw new ServiceUnavailableException('Unable to send your verification code. Please try again later.');
    }
  }
}
