import { Injectable, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

// In-memory OTP store for development (replace with Redis in production)
const otpStore = new Map<string, { code: string; expiresAt: Date; attempts: number }>();

@Injectable()
export class OtpService {
  constructor(private readonly config: ConfigService) {}

  async sendOtp(params: SendOtpParams): Promise<void> {
    const code = this.generateCode();
    const expirySeconds = this.config.get<number>('app.otpExpirySeconds') ?? 300;
    const key = `${params.identifier}:${params.purpose}`;

    otpStore.set(key, {
      code,
      expiresAt: new Date(Date.now() + expirySeconds * 1000),
      attempts: 0,
    });

    if (params.method === 'phone') {
      await this.sendSms(params.identifier, code);
    } else {
      await this.sendEmail(params.identifier, code, params.purpose);
    }
  }

  async verifyOtp(params: VerifyOtpParams): Promise<void> {
    const key = `${params.identifier}:${params.purpose}`;
    const record = otpStore.get(key);

    if (!record) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'OTP has expired or does not exist. Please request a new one.',
      });
    }

    if (new Date() > record.expiresAt) {
      otpStore.delete(key);
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'OTP has expired. Please request a new one.',
      });
    }

    const maxAttempts = this.config.get<number>('app.otpMaxAttempts') ?? 5;
    if (record.attempts >= maxAttempts) {
      otpStore.delete(key);
      throw new BadRequestException({
        code: 'OTP_MAX_ATTEMPTS',
        message: 'Too many attempts. Please request a new OTP.',
      });
    }

    if (record.code !== params.code) {
      record.attempts += 1;
      otpStore.set(key, record);
      throw new UnprocessableEntityException({
        code: 'OTP_INVALID',
        message: `Incorrect code. ${maxAttempts - record.attempts} attempt(s) remaining.`,
      });
    }

    otpStore.delete(key);
  }

  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('app.termiiApiKey');
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log(`[OTP] SMS to ${phone}: ${code}`);
      return;
    }

    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        from: 'LightPay',
        sms: `Your LightPay verification code is: ${code}. Valid for 5 minutes. Never share this code.`,
        type: 'plain',
        channel: 'dnd',
        api_key: apiKey,
      }),
    });

    if (!response.ok) {
      console.error('[OTP] SMS send failed', await response.text());
    }
  }

  private async sendEmail(email: string, code: string, purpose: string): Promise<void> {
    const apiKey = this.config.get<string>('app.sendgridApiKey');
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log(`[OTP] Email to ${email}: ${code}`);
      return;
    }

    const subjects: Record<string, string> = {
      registration: 'Verify your LightPay account',
      login: 'Your LightPay login code',
      transaction: 'Authorise your LightPay transaction',
      reset_pin: 'Reset your LightPay PIN',
    };

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: {
          email: this.config.get('app.fromEmail'),
          name: 'LightPay',
        },
        subject: subjects[purpose] ?? 'Your LightPay code',
        content: [
          {
            type: 'text/plain',
            value: `Your LightPay verification code is: ${code}\n\nThis code expires in 5 minutes. Never share this code with anyone.`,
          },
        ],
      }),
    });
  }
}
