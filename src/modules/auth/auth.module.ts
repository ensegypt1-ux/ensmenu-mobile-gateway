import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { LoginDebugLogger } from './login-debug.logger';

@Module({
  controllers: [AuthController],
  providers: [LoginDebugLogger],
})
export class AuthModule {}
