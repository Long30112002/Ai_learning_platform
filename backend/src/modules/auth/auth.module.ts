import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { UserLogService } from './user-log.service';
import { SecurityService } from './security.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { User } from '../user/entities/user.entity';
import { Role } from '../user/entities/role.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserToken } from './entities/user-token.entity';
import { UserLog } from './entities/user-log.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtConfig = configService.get('jwt');
        return {
          secret: jwtConfig.secret,
          signOptions: { 
            expiresIn: jwtConfig.expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, RefreshToken, Role, UserToken, UserLog]), // ĐÃ CÓ UserLog
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, UserLogService, SecurityService, JwtStrategy, RefreshTokenStrategy],
  exports: [AuthService, TokenService, UserLogService, SecurityService],
})
export class AuthModule {}