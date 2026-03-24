import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as ms from 'ms';

import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserToken} from './entities/user-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { Role } from '../user/entities/role.entity';
import { EmailService } from '../email/email.service';
import { TokenType } from 'src/common/constants/token-type.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(UserToken)
    private userTokenRepository: Repository<UserToken>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) { }

  async register(registerDto: RegisterDto, requestInfo?: any) {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        await this.generateAndSendActivationToken(existingUser, requestInfo);
        return {
          message: 'Please check your email to verify your account.',
          email: existingUser.email,
          requiresVerification: true,
        };
      }
      throw new ConflictException('Email already exists and is verified');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const studentRole = await this.roleRepository.findOne({
      where: { name: 'STUDENT' },
    });

    if (!studentRole) {
      throw new Error('STUDENT role not found in database');
    }

    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      fullName: registerDto.fullName,
      roleId: studentRole.id,
      isActive: false,
      isEmailVerified: false,
    });

    await this.userRepository.save(user);

    await this.generateAndSendActivationToken(user, requestInfo);

    this.logger.log(`User registered: ${user.email}, awaiting verification`);

    return {
      message: 'Registration successful. Please check your email for verification code.',
      email: user.email,
      requiresVerification: true,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.userRepository.findOne({
      where: { email: verifyEmailDto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const validToken = await this.userTokenRepository.findOne({
      where: {
        userId: user.id,
        token: verifyEmailDto.token,
        type: TokenType.ACTIVATION,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!validToken) {
      const expiredToken = await this.userTokenRepository.findOne({
        where: {
          userId: user.id,
          token: verifyEmailDto.token,
          type: TokenType.ACTIVATION,
          usedAt: IsNull(),
          expiresAt: LessThan(new Date()),
        },
      });

      if (expiredToken) {
        throw new BadRequestException('Verification token has expired. Please request a new one.');
      }

      throw new BadRequestException('Invalid verification token');
    }

    validToken.usedAt = new Date();
    await this.userTokenRepository.save(validToken);

    user.isEmailVerified = true;
    user.isActive = true;
    await this.userRepository.save(user);

    await this.userTokenRepository.update(
      {
        userId: user.id,
        type: TokenType.ACTIVATION,
        usedAt: IsNull(),
      },
      {
        usedAt: new Date(),
      }
    );

    await this.emailService.sendWelcomeEmail(user.email, user.fullName);

    this.logger.log(`User verified: ${user.email}`);

    return {
      message: 'Email verified successfully. You can now log in.',
    };
  }

  async resendVerification(resendVerificationDto: ResendVerificationDto, requestInfo?: any) {
    const user = await this.userRepository.findOne({
      where: { email: resendVerificationDto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.generateAndSendActivationToken(user, requestInfo);

    return {
      message: 'Verification code has been resent to your email.',
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled. Please contact support.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role?.name || 'STUDENT',
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async refreshToken(refreshTokenString: string) {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
      relations: ['user'],
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      await this.refreshTokenRepository.delete(refreshToken.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!refreshToken.user.isEmailVerified || !refreshToken.user.isActive) {
      await this.refreshTokenRepository.delete(refreshToken.id);
      throw new UnauthorizedException('User account is not active');
    }

    const tokens = await this.generateTokens(refreshToken.user);
    await this.refreshTokenRepository.delete(refreshToken.id);

    return tokens;
  }

  async logout(userId: number, refreshTokenString?: string) {
    if (refreshTokenString) {
      await this.refreshTokenRepository.delete({
        userId,
        token: refreshTokenString,
      });
    } else {
      await this.refreshTokenRepository.delete({ userId });
    }
    return { message: 'Logged out successfully' };
  }

  async changeEmail(userId: number, changeEmailDto: ChangeEmailDto, requestInfo: any) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(changeEmailDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: changeEmailDto.newEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    await this.userTokenRepository.update(
      {
        userId: user.id,
        type: TokenType.EMAIL_CHANGE,
        usedAt: IsNull(),
      },
      {
        usedAt: new Date(),
      }
    );

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiryMinutes = this.configService.get('VERIFICATION_TOKEN_EXPIRY', 15);
    const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);

    const userToken = this.userTokenRepository.create({
      userId: user.id,
      token: token,
      type: TokenType.EMAIL_CHANGE,
      expiresAt: expiresAt,
      usedAt: null,
      metadata: JSON.stringify({
        newEmail: changeEmailDto.newEmail,
        requestedAt: new Date().toISOString(),
        ip: requestInfo.ip,
        userAgent: requestInfo.userAgent,
      }),
    });

    await this.userTokenRepository.save(userToken);

    await this.emailService.sendVerificationOTP(
      changeEmailDto.newEmail,
      token,
      user.fullName,
    );

    return {
      message: 'Verification code sent to your new email address. Please verify to complete email change.',
    };
  }

  async confirmEmailChange(confirmEmailChangeDto: ConfirmEmailChangeDto) {
    const validToken = await this.userTokenRepository.findOne({
      where: {
        token: confirmEmailChangeDto.token,
        type: TokenType.EMAIL_CHANGE,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!validToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const metadata = JSON.parse(validToken.metadata || '{}');
    const newEmail = metadata.newEmail;

    if (!newEmail || newEmail !== confirmEmailChangeDto.newEmail) {
      throw new BadRequestException('Email mismatch');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: newEmail },
    });

    if (existingUser && existingUser.id !== validToken.userId) {
      throw new ConflictException('Email already in use');
    }

    const oldEmail = validToken.user.email;

    validToken.user.email = newEmail;
    await this.userRepository.save(validToken.user);

    validToken.usedAt = new Date();
    await this.userTokenRepository.save(validToken);

    await this.emailService.sendEmailChangeNotification(
      oldEmail,
      newEmail,
      validToken.user.fullName,
    );

    return {
      message: 'Email changed successfully. Please log in with your new email.',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto, requestInfo: any) {
    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      return {
        message: 'If your email is registered, you will receive a password reset link.',
      };
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException('Please verify your email first');
    }

    await this.userTokenRepository.update(
      {
        userId: user.id,
        type: TokenType.PASSWORD_RESET,
        usedAt: IsNull(),
      },
      {
        usedAt: new Date(),
      }
    );

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiryMinutes = this.configService.get('VERIFICATION_TOKEN_EXPIRY', 15);
    const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);

    const userToken = this.userTokenRepository.create({
      userId: user.id,
      token: token,
      type: TokenType.PASSWORD_RESET,
      expiresAt: expiresAt,
      usedAt: null,
      metadata: JSON.stringify({
        requestedAt: new Date().toISOString(),
        ip: requestInfo.ip,
        userAgent: requestInfo.userAgent,
        location: requestInfo.location || 'Unknown location',
      }),
    });

    await this.userTokenRepository.save(userToken);

    await this.emailService.sendPasswordResetEmail(
      user.email,
      token,
      user.fullName,
      {
        deviceInfo: requestInfo.userAgent,
        location: requestInfo.location,
      }
    );

    return {
      message: 'If your email is registered, you will receive a password reset link.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const validToken = await this.userTokenRepository.findOne({
      where: {
        token: resetPasswordDto.token,
        type: TokenType.PASSWORD_RESET,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!validToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    
    validToken.user.password = hashedPassword;
    await this.userRepository.save(validToken.user);

    validToken.usedAt = new Date();
    await this.userTokenRepository.save(validToken);

    await this.refreshTokenRepository.delete({ userId: validToken.user.id });

    return {
      message: 'Password reset successfully. Please log in with your new password.',
    };
  }

  private async generateAndSendActivationToken(user: User, requestInfo?: any): Promise<void> {
    await this.userTokenRepository.update(
      {
        userId: user.id,
        type: TokenType.ACTIVATION,
        usedAt: IsNull(),
      },
      {
        usedAt: new Date(),
      }
    );

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiryMinutes = this.configService.get('VERIFICATION_TOKEN_EXPIRY', 15);
    const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);

    const userToken = this.userTokenRepository.create({
      userId: user.id,
      token: token,
      type: TokenType.ACTIVATION,
      expiresAt: expiresAt,
      usedAt: null,
      metadata: requestInfo ? JSON.stringify({
        generatedAt: new Date().toISOString(),
        ip: requestInfo.ip,
        userAgent: requestInfo.userAgent,
      }) : null,
    });

    await this.userTokenRepository.save(userToken);

    await this.emailService.sendVerificationOTP(
      user.email,
      token,
      user.fullName,
    );

    this.logger.log(`Activation token generated for: ${user.email}`);
  }

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role?.name || 'STUDENT',
    };

    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    const [accessToken, refreshTokenString] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    await this.refreshTokenRepository.delete({ userId: user.id });

    const expiresAt = new Date(Date.now() + (ms as any).default(refreshExpiresIn));

    await this.refreshTokenRepository.save({
      userId: user.id,
      token: refreshTokenString,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
    };
  }

  async cleanupExpiredTokens() {
    const expiredTokens = await this.userTokenRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
        usedAt: IsNull(),
      },
    });

    for (const token of expiredTokens) {
      token.usedAt = new Date();
    }

    await this.userTokenRepository.save(expiredTokens);

    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(`Cleaned up ${expiredTokens.length} expired tokens`);
  }
}