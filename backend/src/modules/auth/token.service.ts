// modules/auth/token.service.ts (phiên bản hoàn chỉnh)

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserToken } from './entities/user-token.entity';
import { User } from '../user/entities/user.entity';
import { EmailService } from '../email/email.service';
import { TokenType } from 'src/common/constants/token-type.enum';

export interface TokenGenerationOptions {
  userId: number;
  type: TokenType;
  expiryMinutes?: number;
  metadata?: any;
  rateLimitSeconds?: number;
  sendEmail?: boolean;
  emailRecipient?: string;
  emailContext?: any;
}

export interface TokenValidationResult {
  isValid: boolean;
  token?: UserToken;
  error?: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly defaultRateLimitSeconds: number;
  private readonly defaultExpiryMinutes: number;

  constructor(
    @InjectRepository(UserToken)
    private userTokenRepository: Repository<UserToken>,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    this.defaultRateLimitSeconds = this.configService.get('RATE_LIMIT_SECONDS', 60);
    this.defaultExpiryMinutes = this.configService.get('VERIFICATION_TOKEN_EXPIRY', 15);
  }

  /**
   * Generic method to generate or update token with rate limiting
   * @param options Token generation options
   * @returns Generated token string or null if failed
   */
  async generateOrUpdateToken(options: TokenGenerationOptions): Promise<string | null> {
    const {
      userId,
      type,
      expiryMinutes = this.defaultExpiryMinutes,
      metadata = null,
      rateLimitSeconds = this.defaultRateLimitSeconds,
    } = options;

    // Find existing unused token
    const existingToken = await this.userTokenRepository.findOne({
      where: {
        userId,
        type,
        usedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    // Check rate limiting
    if (existingToken && existingToken.createdAt) {
      const timeSinceLastToken = (Date.now() - existingToken.createdAt.getTime()) / 1000;

      if (timeSinceLastToken < rateLimitSeconds) {
        const waitTime = Math.ceil(rateLimitSeconds - timeSinceLastToken);
        throw new HttpException(
          {
            message: `Please wait ${waitTime} seconds before requesting a new ${this.getTokenTypeName(type)}.`,
            waitTime: waitTime,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Generate new token
    const newToken = this.generateToken();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    if (existingToken) {
      // UPDATE existing token
      existingToken.token = newToken;
      existingToken.expiresAt = expiresAt;
      existingToken.metadata = metadata ? JSON.stringify(metadata) : null;
      existingToken.updatedAt = new Date();
      existingToken.createdAt = new Date();
      await this.userTokenRepository.save(existingToken);
      this.logger.log(`Updated ${type} token for user ${userId}`);
    } else {
      // INSERT new token
      const userToken = this.userTokenRepository.create({
        userId,
        token: newToken,
        type,
        expiresAt,
        usedAt: null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
      await this.userTokenRepository.save(userToken);
      this.logger.log(`Created ${type} token for user ${userId}`);
    }

    // Send email if requested
    if (options.sendEmail && options.emailRecipient) {
      const emailSent = await this.sendEmailByType(type, options);
      if (!emailSent) {
        this.logger.error(`Failed to send ${type} email to ${options.emailRecipient}`);
        return null;
      }
    }

    return newToken;
  }

  /**
   * Find token by token value (for cases when user ID is unknown)
   * @param token Token string
   * @param type Token type
   * @param includeUser Whether to include user relation
   * @returns Token with user relation if found and valid
   */
  async findTokenByValue(
    token: string,
    type: TokenType,
    includeUser: boolean = true,
  ): Promise<UserToken | null> {
    const relations = includeUser ? ['user'] : [];

    return await this.userTokenRepository.findOne({
      where: {
        token,
        type,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations,
    });
  }

  /**
   * Find expired token by value (for better error messages)
   * @param token Token string
   * @param type Token type
   * @returns Token with user relation if found and expired
   */
  async findExpiredTokenByValue(
    token: string,
    type: TokenType,
  ): Promise<UserToken | null> {
    return await this.userTokenRepository.findOne({
      where: {
        token,
        type,
        usedAt: IsNull(),
        expiresAt: LessThan(new Date()),
      },
      relations: ['user'],
    });
  }

  /**
   * Mark token as used and optionally update related data
   * @param token UserToken entity
   * @param additionalData Optional data to update
   */
  async markTokenAsUsed(token: UserToken, additionalData?: Partial<UserToken>): Promise<void> {
    token.usedAt = new Date();
    if (additionalData) {
      Object.assign(token, additionalData);
    }
    await this.userTokenRepository.save(token);
  }

  /**
   * Validate and consume a token by value (one-time use)
   * @param token Token string
   * @param type Token type
   * @returns UserToken with user relation if valid
   */
  async consumeTokenByValue(
    token: string,
    type: TokenType,
  ): Promise<UserToken | null> {
    const userToken = await this.findTokenByValue(token, type, true);

    if (!userToken) {
      return null;
    }

    await this.markTokenAsUsed(userToken);
    return userToken;
  }

  /**
   * Validate a token with user ID
   * @param userId User ID
   * @param token Token string
   * @param type Token type
   * @param markAsUsed Whether to mark token as used after validation
   * @returns Validation result with token if valid
   */
  async validateToken(
    userId: number,
    token: string,
    type: TokenType,
    markAsUsed: boolean = true,
  ): Promise<TokenValidationResult> {
    const validToken = await this.userTokenRepository.findOne({
      where: {
        userId,
        token,
        type,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!validToken) {
      // Check if token exists but expired
      const expiredToken = await this.userTokenRepository.findOne({
        where: {
          userId,
          token,
          type,
          usedAt: IsNull(),
          expiresAt: LessThan(new Date()),
        },
      });

      if (expiredToken) {
        return {
          isValid: false,
          error: 'Token has expired',
        };
      }

      return {
        isValid: false,
        error: 'Invalid token',
      };
    }

    if (markAsUsed) {
      validToken.usedAt = new Date();
      await this.userTokenRepository.save(validToken);
    }

    return {
      isValid: true,
      token: validToken,
    };
  }

  /**
   * Invalidate all unused tokens of a specific type for a user
   */
  async invalidateTokens(userId: number, type: TokenType): Promise<void> {
    await this.userTokenRepository.update(
      {
        userId,
        type,
        usedAt: IsNull(),
      },
      {
        usedAt: new Date(),
      },
    );
    this.logger.log(`Invalidated all ${type} tokens for user ${userId}`);
  }

  /**
   * Get the most recent token for a user
   */
  async getLatestToken(userId: number, type: TokenType): Promise<UserToken | null> {
    return await this.userTokenRepository.findOne({
      where: {
        userId,
        type,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
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
    this.logger.log(`Cleaned up ${expiredTokens.length} expired tokens`);

    return expiredTokens.length;
  }

  /**
   * Generate a random 6-digit token
   */
  private generateToken(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get human-readable token type name
   */
  private getTokenTypeName(type: TokenType): string {
    const names = {
      [TokenType.ACTIVATION]: 'verification code',
      [TokenType.PASSWORD_RESET]: 'password reset code',
      [TokenType.EMAIL_CHANGE]: 'email change code',
      [TokenType.TWO_FA]: 'two-factor authentication code',
    };
    return names[type] || 'verification code';
  }

  /**
   * Send email based on token type
   */
  private async sendEmailByType(type: TokenType, options: TokenGenerationOptions): Promise<boolean> {
    const { emailRecipient, emailContext, userId } = options;

    if (!emailRecipient) return false;

    // Get user info for email
    const userToken = await this.userTokenRepository.findOne({
      where: {
        userId,
        type,
        usedAt: IsNull(),
      },
      relations: ['user'],
      order: {
        createdAt: 'DESC',
      },
    });

    if (!userToken) return false;

    const user = userToken.user;
    const token = userToken.token;

    switch (type) {
      case TokenType.ACTIVATION:
        return await this.emailService.sendVerificationOTP(
          emailRecipient,
          token,
          user?.fullName,
        );

      case TokenType.PASSWORD_RESET:
        return await this.emailService.sendPasswordResetEmail(
          emailRecipient,
          token,
          user?.fullName,
          emailContext,
        );

      case TokenType.EMAIL_CHANGE:
        return await this.emailService.sendVerificationOTP(
          emailRecipient,
          token,
          user?.fullName,
        );

      default:
        return false;
    }
  }

  async createResetPasswordToken(userId: number, expiryMinutes: number = 15): Promise<string> {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const resetToken = this.userTokenRepository.create({
      userId,
      token,
      type: TokenType.PASSWORD_RESET,
      expiresAt,
      usedAt: null,
      metadata: JSON.stringify({
        purpose: 'account_recovery',
        created_at: new Date().toISOString(),
      }),
    });

    await this.userTokenRepository.save(resetToken);
    return token;
  }

  async revokeEmailChangeRequests(userId: number): Promise<void> {
    const pendingTokens = await this.userTokenRepository.find({
      where: {
        userId,
        type: TokenType.EMAIL_CHANGE,
        usedAt: IsNull(),
      },
      relations: ['user'],
    });

    for (const token of pendingTokens) {
      token.usedAt = new Date();
      await this.userTokenRepository.save(token);

      // Log the revocation
      this.logger.warn(
        `Revoked email change token for user ${userId}. ` +
        `Target email: ${JSON.parse(token.metadata || '{}').newEmail}`
      );
    }
  }
}