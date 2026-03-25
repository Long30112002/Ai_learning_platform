import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan, MoreThan } from 'typeorm';
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
import { SecurityService } from './security.service';
import { UserLogService } from './user-log.service';
import { UserLogAction } from 'src/common/constants/user-log-action.enum';
import { UserAccessLevel } from 'src/common/constants/user-access-level.enum';
import { UserLog } from './entities/user-log.entity';
import { UserToken } from './entities/user-token.entity';

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
    @InjectRepository(UserToken)
    private userTokenRepository: Repository<UserToken>,
    @InjectRepository(UserLog)
    private userLogRepository: Repository<UserLog>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenService: TokenService,
    private emailService: EmailService,
    private userLogService: UserLogService,
    private securityService: SecurityService,

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
      accessLevel: UserAccessLevel.FULL,
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
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const isPasswordValid = await bcrypt.compare(changeEmailDto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid password');

    const existingUser = await this.userRepository.findOne({ where: { email: changeEmailDto.newEmail } });
    if (existingUser) throw new ConflictException('Email already in use');
    if (user.email === changeEmailDto.newEmail) throw new BadRequestException('New email must be different');

    const token = await this.tokenService.generateOrUpdateToken({
      userId: user.id,
      type: TokenType.EMAIL_CHANGE,
      expiryMinutes: 15,
      metadata: {
        newEmail: changeEmailDto.newEmail,
        oldEmail: user.email,
        requestedAt: new Date().toISOString(),
        ip: requestInfo?.ip,
        userAgent: requestInfo?.userAgent,
        isApproved: false,
      },
      sendEmail: false,
    });

    if (!token) throw new HttpException('Failed to generate code', HttpStatus.INTERNAL_SERVER_ERROR);

    await this.emailService.sendEmailChangeOTP(changeEmailDto.newEmail, token, user.fullName);

    const approvalToken = this.generateRecoveryToken();
    const approvalExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.emailService.sendEmailChangeApproval(
      user.email,
      changeEmailDto.newEmail,
      user.fullName,
      approvalToken,
      token
    );

    await this.userLogService.log(user.id, UserLogAction.EMAIL_CHANGE_REQUEST, {
      metadata: {
        newEmail: changeEmailDto.newEmail,
        changeToken: token,
        ip: requestInfo?.ip,
        userAgent: requestInfo?.userAgent,
      },
      recoveryToken: approvalToken,
      recoveryExpiresAt: approvalExpiresAt,
    });

    return {
      message: 'Verification code sent to new email. Approval link sent to your current email. You must approve from your current email before using the code.',
      newEmail: changeEmailDto.newEmail,
      oldEmail: user.email,
      requiresApproval: true,
    };
  }

  async approveEmailChange(approvalToken: string, changeToken: string): Promise<{ message: string }> {
    const log = await this.userLogService.findEmailChangeLogByApprovalToken(approvalToken);
    if (!log) {
      throw new BadRequestException('Invalid or expired approval token');
    }

    const userToken = await this.tokenService['userTokenRepository'].findOne({
      where: {
        token: changeToken,
        type: TokenType.EMAIL_CHANGE,
      },
      relations: ['user'],
    });

    if (!userToken) {
      throw new BadRequestException('Invalid email change request');
    }

    if (userToken.expiresAt < new Date()) {
      throw new BadRequestException('This request has expired. Please create a new email change request.');
    }

    if (userToken.usedAt !== null) {
      throw new BadRequestException('This request has already been processed.');
    }

    const metadata = JSON.parse(userToken.metadata || '{}');
    if (metadata.isApproved) {
      throw new BadRequestException('This request has already been approved.');
    }

    metadata.isApproved = true;
    metadata.approvedAt = new Date().toISOString();
    metadata.approvedByIp = log.ipAddress;
    userToken.metadata = JSON.stringify(metadata);
    await this.tokenService['userTokenRepository'].save(userToken);

    await this.userLogService.markRecoveryTokenUsed(log.id);

    await this.emailService.sendEmailChangeApproved(
      userToken.user.email,
      userToken.user.fullName
    );

    await this.userLogService.log(userToken.userId, UserLogAction.EMAIL_CHANGE_APPROVED, {
      metadata: {
        changeToken: changeToken,
        approvalToken: approvalToken,
        approvedAt: new Date().toISOString(),
      },
    });

    return {
      message: 'Email change request approved. The user can now use the verification code to complete the email change.',
    };
  }
  async confirmEmailChange(confirmEmailChangeDto: ConfirmEmailChangeDto) {
    const userToken = await this.tokenService['userTokenRepository'].findOne({
      where: {
        token: confirmEmailChangeDto.token,
        type: TokenType.EMAIL_CHANGE,
      },
      relations: ['user'],
    });

    if (!userToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (userToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired. Please request a new one.');
    }

    if (userToken.usedAt !== null) {
      throw new BadRequestException('This verification code has already been used.');
    }

    const metadata = JSON.parse(userToken.metadata || '{}');
    if (!metadata.isApproved) {
      throw new BadRequestException(
        'This email change request has not been approved. ' +
        'Please check your old email inbox and click the approval link first.'
      );
    }

    const newEmail = metadata.newEmail;
    const oldEmail = metadata.oldEmail || userToken.user.email;

    if (!newEmail || newEmail !== confirmEmailChangeDto.newEmail) {
      throw new BadRequestException('Email mismatch');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: newEmail },
    });

    if (existingUser && existingUser.id !== userToken.userId) {
      throw new ConflictException('Email already in use');
    }

    const user = userToken.user;
    const finalOldEmail = user.email;

    user.email = newEmail;
    user.previousEmail = finalOldEmail;
    user.lastSecurityChange = new Date();
    await this.userRepository.save(user);

    await this.refreshTokenRepository.delete({ userId: user.id });

    userToken.usedAt = new Date();
    await this.tokenService['userTokenRepository'].save(userToken);

    await this.emailService.sendEmailChangeCompletion(finalOldEmail, newEmail, user.fullName);

    await this.userLogService.log(user.id, UserLogAction.EMAIL_CHANGE, {
      oldValue: { email: finalOldEmail },
      newValue: { email: newEmail },
      metadata: {
        changeToken: confirmEmailChangeDto.token,
        approvedAt: metadata.approvedAt,
      },
    });

    return {
      message: 'Email changed successfully! All your sessions have been terminated for security. ' +
        'Please log in with your new email address.',
      requiresRelogin: true,
      newEmail: newEmail,
    };
  }

  async performSensitiveAction(userId: number, actionName: string): Promise<{ allowed: boolean; message?: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    try {
      await this.securityService.checkSecurityGracePeriod(user, actionName);
      return { allowed: true };
    } catch (error) {
      return { allowed: false, message: error.message };
    }
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

  async secureMyAccount(
    userId: number,
    token: string,
    requestInfo?: any
  ): Promise<{ message: string }> {
    let targetUserId = userId;

    if (token) {
      const log = await this.userLogRepository.findOne({
        where: {
          recoveryToken: token,
          recoveryUsed: false,
          recoveryExpiresAt: MoreThan(new Date()),
        },
        relations: ['user'],
      });

      if (!log) {
        throw new BadRequestException('Invalid or expired security token');
      }

      targetUserId = log.userId;
    }

    if (!targetUserId) {
      throw new BadRequestException('User ID or token is required');
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['role'],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 1. Revoke all pending email change tokens
    await this.tokenService.revokeEmailChangeRequests(user.id);

    // 2. Global logout - delete all refresh tokens
    const deletedCount = await this.refreshTokenRepository.delete({ userId: user.id });
    this.logger.log(`Global logout for user ${user.id}: deleted ${deletedCount.affected} refresh tokens`);

    // 3. Save old state before changes
    const wasSuspended = user.accessLevel === UserAccessLevel.SUSPENDED;
    const wasActive = user.isActive;

    // 4. Lockdown account
    user.isActive = false;
    user.accessLevel = UserAccessLevel.SUSPENDED;
    user.previousEmail = user.email;
    user.lastSecurityChange = new Date();

    // 5. Invalidate current password - set to random string
    const randomPassword = this.generateRandomPassword();
    const hashedRandomPassword = await bcrypt.hash(randomPassword, 10);
    user.password = hashedRandomPassword;

    await this.userRepository.save(user);

    // 6. Create reset password token
    const resetToken = await this.tokenService.createResetPasswordToken(user.id, 60);
    const resetLink = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}&email=${user.email}`;

    // 7. Send password reset email
    await this.emailService.sendAccountRecoveryEmail(
      user.email,
      resetToken,
      user.fullName,
      resetLink,
      requestInfo
    );

    await this.userLogService.log(user.id, UserLogAction.ACCOUNT_LOCK, {
      metadata: {
        reason: 'emergency_recovery',
        ip: requestInfo?.ip,
        userAgent: requestInfo?.userAgent,
        deletedSessions: deletedCount.affected,
        wasSuspended,
        wasActive,
      },
      ipAddress: requestInfo?.ip,
      userAgent: requestInfo?.userAgent,
    });

    if (token) {
      await this.userLogRepository.update(
        { recoveryToken: token },
        { recoveryUsed: true }
      );
    }

    this.logger.warn(`Account secured for user ${user.id}: ${user.email}. Password reset required.`);

    return {
      message: 'Your account has been secured!\n\n' +
        '• All pending email changes cancelled\n' +
        '• All sessions logged out\n' +
        '• Account temporarily locked\n' +
        '• Password reset link sent to your email\n\n' +
        'Please check your email to set a new password and regain access.',
    };
  }

  private generateRandomPassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }


  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const userToken = await this.tokenService.consumeTokenByValue(
      resetPasswordDto.token,
      TokenType.PASSWORD_RESET,
    );

    if (!userToken) {
      const expiredToken = await this.tokenService.findExpiredTokenByValue(
        resetPasswordDto.token,
        TokenType.PASSWORD_RESET,
      );
      if (expiredToken) {
        throw new BadRequestException('Reset token has expired. Please request a new one.');
      }
      throw new BadRequestException('Invalid reset token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    const user = userToken.user;

    const wasSuspended = user.accessLevel === UserAccessLevel.SUSPENDED;
    const wasInactive = !user.isActive;

    user.password = hashedPassword;
    user.isActive = true;
    user.accessLevel = UserAccessLevel.FULL;
    user.lastSecurityChange = new Date();
    await this.userRepository.save(user);

    await this.refreshTokenRepository.delete({ userId: user.id });

    await this.userLogService.log(user.id, UserLogAction.ACCOUNT_UNLOCK, {
      metadata: {
        reason: 'password_reset',
        wasSuspended: wasSuspended,
        wasInactive: wasInactive,
      },
    });

    return {
      message: 'Password reset successfully! Your account is now unlocked and you have FULL access.',
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

  private generateRecoveryToken(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }
}