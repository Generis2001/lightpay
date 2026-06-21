import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesService } from './devices.service';
import { UserDevice } from './device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserDevice])],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
