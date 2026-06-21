import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from './device.entity';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(UserDevice)
    private readonly deviceRepo: Repository<UserDevice>,
  ) {}

  async registerDevice(params: {
    userId: string;
    deviceId: string;
    deviceName?: string;
    platform?: string;
    pushToken?: string;
    fingerprint?: string;
  }): Promise<UserDevice> {
    let device = await this.deviceRepo.findOne({
      where: { userId: params.userId, deviceId: params.deviceId },
    });

    if (device) {
      device.lastSeenAt = new Date();
      if (params.pushToken) device.pushToken = params.pushToken;
      if (params.deviceName) device.deviceName = params.deviceName;
    } else {
      device = this.deviceRepo.create({
        userId: params.userId,
        deviceId: params.deviceId,
        deviceName: params.deviceName ?? null,
        platform: params.platform ?? null,
        pushToken: params.pushToken ?? null,
        fingerprint: params.fingerprint ?? params.deviceId,
        isTrusted: false,
        lastSeenAt: new Date(),
      });
    }

    return this.deviceRepo.save(device);
  }

  async markBiometricEnabled(deviceId: string, userId: string): Promise<void> {
    await this.deviceRepo.update(
      { deviceId, userId },
      { biometricEnabled: true, isTrusted: true },
    );
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return this.deviceRepo.find({ where: { userId } });
  }

  async removeDevice(deviceId: string, userId: string): Promise<void> {
    await this.deviceRepo.delete({ deviceId, userId });
  }
}
