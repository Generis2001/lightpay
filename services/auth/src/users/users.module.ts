import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserAuth } from './user-auth.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserAuth])],
  exports: [TypeOrmModule],
})
export class UsersModule {}
