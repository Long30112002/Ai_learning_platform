import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as ms from 'ms';

import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
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
import { TokenService } from './token.service';
import { TokenType } from 'src/common/constants/token-type.enum';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenService: TokenService,
    private emailService: EmailService,
  ) { }

  async register(registerDto: RegisterDto, requestInfo?: any) {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        // Generate activation token
        const token = await this.tokenService.generateOrUpdateToken({
          userId: existingUser.id,
          type: TokenType.ACTIVATION,
          metadata: {
            generatedAt: new Date().toISOString(),
            ip: requestInfo?.ip,
            userAgent: requestInfo?.userAgent,
          },
          sendEmail: true,
          emailRecipient: existingUser.email,
          emailContext: { fullName: existingUser.fullName },
        });

        if (!token) {
          throw new HttpException(
            'Failed to send verification email. Please try again later.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

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

    // Generate activation token
    const token = await this.tokenService.generateOrUpdateToken({
      userId: user.id,
      type: TokenType.ACTIVATION,
      metadata: {
        generatedAt: new Date().toISOString(),
        ip: requestInfo?.ip,
        userAgent: requestInfo?.userAgent,
      },
      sendEmail: true,
      emailRecipient: user.email,
      emailContext: { fullName: user.fullName },
    });

    if (!token) {
      this.logger.warn(`User registered but email failed: ${user.email}`);
    }

    return {
      message: token
        ? 'Registration successful. Please check your email for verification code.'
        : 'Registration successful but we could not send verification email. Please use resend verification endpoint.',
      email: user.email,
      requiresVerification: true,
      emailSent: !!token,
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

    // Validate token
    const validation = await this.tokenService.validateToken(
      user.id,
      verifyEmailDto.token,
      TokenType.ACTIVATION,
      true, // mark as used
    );

    if (!validation.isValid) {
      throw new BadRequestException(validation.error === 'Token has expired'
        ? 'Verification token has expired. Please request a new one.'
        : 'Invalid verification token');
    }

    // Activate user
    user.isEmailVerified = true;
    user.isActive = true;
    await this.userRepository.save(user);

    // Invalidate all other activation tokens
    await this.tokenService.invalidateTokens(user.id, TokenType.ACTIVATION);

    // Send welcome email (don't block if fails)
    await this.tokenService['emailService'].sendWelcomeEmail(user.email, user.fullName)
      .catch(error => {
        this.logger.error(`Failed to send welcome email to ${user.email}:`, error);
      });

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

    const token = await this.tokenService.generateOrUpdateToken({
      userId: user.id,
      type: TokenType.ACTIVATION,
      metadata: {
        generatedAt: new Date().toISOString(),
        ip: requestInfo?.ip,
        userAgent: requestInfo?.userAgent,
      },
      sendEmail: true,
      emailRecipient: user.email,
      emailContext: { fullName: user.fullName },
    });

    if (!token) {
      throw new HttpException(
        'Failed to send verification email. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message: 'Verification code has been resent to your email.',
    };
  }

  async changeEmail(userId: number, changeEmailDto: ChangeEmailDto, requestInfo: any) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(changeEmailDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Check if new email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: changeEmailDto.newEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Check if new email is the same as current
    if (user.email === changeEmailDto.newEmail) {
      throw new BadRequestException('New email must be different from current email');
    }

    // ========== PHASE 1: SEND ALERT AND OTP ==========

    const alertSent = await this.emailService.sendEmailChangeAlert(
      user.email,
      changeEmailDto.newEmail,
      user.fullName,
    );

    if (!alertSent) {
      this.logger.warn(`Failed to send email change alert to ${user.email}`);
    }

    const token = await this.tokenService.generateOrUpdateToken({
      userId: user.id,
      type: TokenType.EMAIL_CHANGE,
      expiryMinutes: this.configService.get('VERIFICATION_TOKEN_EXPIRY', 15),
      metadata: {
        newEmail: changeEmailDto.newEmail,
        oldEmail: user.email,
        requestedAt: new Date().toISOString(),
        ip: requestInfo?.ip,
        userAgent: requestInfo?.userAgent,
      },
      sendEmail: false,
    });

    if (!token) {
      throw new HttpException(
        'Failed to generate verification code. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Send OTP email to new address
    const otpSent = await this.emailService.sendEmailChangeOTP(
      changeEmailDto.newEmail,
      token,
      user.fullName,
    );

    if (!otpSent) {
      throw new HttpException(
        'Failed to send verification email to new address. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log(
      `Email change requested for user ${user.id}: ${user.email} -> ${changeEmailDto.newEmail}`
    );

    return {
      message: 'A verification code has been sent to your new email address. ' +
        'A security alert has also been sent to your current email. ' +
        'Please check both emails and enter the code to complete the email change.',
      newEmail: changeEmailDto.newEmail,
      oldEmail: user.email,
      alertSent: alertSent,
      otpSent: otpSent,
    };
  }

  async confirmEmailChange(confirmEmailChangeDto: ConfirmEmailChangeDto) {
    // ========== PHASE 2: CONFIRM OTP ==========

    // Find and consume token
    const userToken = await this.tokenService.consumeTokenByValue(
      confirmEmailChangeDto.token,
      TokenType.EMAIL_CHANGE,
    );

    if (!userToken) {
      // Check if token exists but expired
      const expiredToken = await this.tokenService.findExpiredTokenByValue(
        confirmEmailChangeDto.token,
        TokenType.EMAIL_CHANGE,
      );

      if (expiredToken) {
        throw new BadRequestException('Verification token has expired. Please request a new one.');
      }

      throw new BadRequestException('Invalid verification token');
    }

    const metadata = JSON.parse(userToken.metadata || '{}');
    const newEmail = metadata.newEmail;
    const oldEmail = metadata.oldEmail || userToken.user.email;

    if (!newEmail || newEmail !== confirmEmailChangeDto.newEmail) {
      throw new BadRequestException('Email mismatch');
    }

    // Check if new email already exists (double-check)
    const existingUser = await this.userRepository.findOne({
      where: { email: newEmail },
    });

    if (existingUser && existingUser.id !== userToken.userId) {
      throw new ConflictException('Email already in use');
    }

    // ========== PHASE 3: UPDATE DATABASE AND FORCE LOGOUT ==========

    const oldUserEmail = userToken.user.email;

    // Update user email
    userToken.user.email = newEmail;
    await this.userRepository.save(userToken.user);

    // IMPORTANT: Force logout all sessions - delete all refresh tokens
    const deletedRefreshTokens = await this.refreshTokenRepository.delete({
      userId: userToken.user.id
    });

    this.logger.log(
      `✅ Email changed for user ${userToken.user.id}: ${oldUserEmail} -> ${newEmail}. ` +
      `Invalidated ${deletedRefreshTokens.affected || 0} refresh tokens.`
    );

    // ========== PHASE 4: SEND COMPLETION NOTIFICATIONS ==========

    await this.emailService.sendEmailChangeCompletion(
      oldEmail,
      newEmail,
      userToken.user.fullName,
    );

    return {
      message: '✅ Email changed successfully! All your sessions have been terminated for security. ' +
        'Please log in with your new email address. ' +
        'A confirmation email has been sent to both your old and new email addresses.',
      requiresRelogin: true,
      newEmail: newEmail,
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

    const token = await this.tokenService.generateOrUpdateToken({
      userId: user.id,
      type: TokenType.PASSWORD_RESET,
      metadata: {
        requestedAt: new Date().toISOString(),
        ip: requestInfo?.ip,
        userAgent: requestInfo?.userAgent,
        location: requestInfo?.location || 'Unknown location',
      },
      sendEmail: true,
      emailRecipient: user.email,
      emailContext: {
        fullName: user.fullName,
        deviceInfo: requestInfo?.userAgent,
        location: requestInfo?.location,
      },
    });

    if (!token) {
      throw new HttpException(
        'Failed to send password reset email. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message: 'If your email is registered, you will receive a password reset link.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    // Use TokenService to find and consume token
    const userToken = await this.tokenService.consumeTokenByValue(
      resetPasswordDto.token,
      TokenType.PASSWORD_RESET,
    );

    if (!userToken) {
      // Check if token exists but expired
      const expiredToken = await this.tokenService['userTokenRepository'].findOne({
        where: {
          token: resetPasswordDto.token,
          type: TokenType.PASSWORD_RESET,
          usedAt: IsNull(),
          expiresAt: LessThan(new Date()),
        },
        relations: ['user'],
      });

      if (expiredToken) {
        throw new BadRequestException('Reset token has expired. Please request a new one.');
      }

      throw new BadRequestException('Invalid reset token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    userToken.user.password = hashedPassword;
    await this.userRepository.save(userToken.user);

    // Invalidate all refresh tokens for security
    await this.refreshTokenRepository.delete({ userId: userToken.user.id });

    return {
      message: 'Password reset successfully. Please log in with your new password.',
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
}