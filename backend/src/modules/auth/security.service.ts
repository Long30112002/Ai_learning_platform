import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import { UserAccessLevel } from 'src/common/constants/user-access-level.enum';

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  requiredLevel?: UserAccessLevel;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly recoveryPeriodHours: number;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {
    this.recoveryPeriodHours = this.configService.get('RECOVERY_PERIOD_HOURS', 48);
  }

  canPerformAction(user: User, action: string): SecurityCheckResult {
    if (user.accessLevel === UserAccessLevel.FULL) {
      return { allowed: true };
    }

    if (user.accessLevel === UserAccessLevel.SUSPENDED) {
      return {
        allowed: false,
        reason: 'Account is temporarily suspended. Please check your email for recovery instructions.',
        requiredLevel: UserAccessLevel.FULL
      };
    }

    if (user.accessLevel === UserAccessLevel.LIMITED) {
      const restrictedActions = [
        'withdraw_money',
        'transfer_funds',
        'delete_account',
        'change_password',
        'change_email',
        'change_payment_method',
      ];

      if (restrictedActions.includes(action)) {
        return {
          allowed: false,
          reason: `Security: You recently changed your email. To ${action.replace('_', ' ')}, please check your old email inbox and click the confirmation link.`,
          requiredLevel: UserAccessLevel.FULL,
        };
      }

      return { allowed: true };
    }

    return { allowed: true };
  }

  getAccessLevelDescription(level: string): string {
    switch (level) {
      case 'FULL':
        return 'Full access - You can use all features.';
      case 'LIMITED':
        return `Limited access - You can learn and view content. Sensitive actions require confirmation from your old email. Recovery period: ${this.recoveryPeriodHours} hours.`;
      case 'SUSPENDED':
        return 'Account suspended - Please check your email to recover your account.';
      default:
        return 'Unknown access level';
    }
  }

  async updateSecurityTimestamp(userId: number): Promise<void> {
    this.logger.log(`User ${userId} security status updated`);
  }

  async getSecurityStatus(user: User): Promise<{
    isGracePeriodActive: boolean;
    daysSinceLastChange: number;
    remainingDays: number;
    lastChangeDate: Date | null;
  }> {
    if (!user.recoveryExpiresAt) {
      return {
        isGracePeriodActive: false,
        daysSinceLastChange: 0,
        remainingDays: 0,
        lastChangeDate: null,
      };
    }

    const now = new Date();
    const hoursSinceLastChange = (now.getTime() - user.recoveryExpiresAt.getTime()) / (1000 * 3600);
    const isGracePeriodActive = hoursSinceLastChange < this.recoveryPeriodHours;
    const remainingHours = Math.max(0, this.recoveryPeriodHours - hoursSinceLastChange);

    return {
      isGracePeriodActive,
      daysSinceLastChange: Math.floor(hoursSinceLastChange / 24),
      remainingDays: Math.ceil(remainingHours / 24),
      lastChangeDate: user.recoveryExpiresAt,
    };
  }

  async checkSecurityGracePeriod(user: User, actionName: string): Promise<void> {
    if (!user.lastSecurityChange) {
      return;
    }

    const now = new Date();
    const daysSinceLastChange = (now.getTime() - user.lastSecurityChange.getTime()) / (1000 * 3600 * 24);
    const gracePeriodDays = 7; // 7 days

    if (daysSinceLastChange < gracePeriodDays) {
      const remainingDays = Math.ceil(gracePeriodDays - daysSinceLastChange);
      throw new ForbiddenException(
        `⚠️ For security reasons, ${actionName} is temporarily blocked. ` +
        `You changed your email ${Math.floor(daysSinceLastChange)} days ago. ` +
        `Please wait ${remainingDays} more day(s) to use this feature.`
      );
    }
  }

  async getGracePeriodStatus(user: User): Promise<{
    isBlocked: boolean;
    daysSinceLastChange: number;
    remainingDays: number;
    lastChangeDate: Date | null;
  }> {
    if (!user.lastSecurityChange) {
      return {
        isBlocked: false,
        daysSinceLastChange: 0,
        remainingDays: 0,
        lastChangeDate: null,
      };
    }

    const now = new Date();
    const daysSinceLastChange = (now.getTime() - user.lastSecurityChange.getTime()) / (1000 * 3600 * 24);
    const gracePeriodDays = 7;
    const isBlocked = daysSinceLastChange < gracePeriodDays;
    const remainingDays = Math.max(0, Math.ceil(gracePeriodDays - daysSinceLastChange));

    return {
      isBlocked,
      daysSinceLastChange: Math.floor(daysSinceLastChange),
      remainingDays,
      lastChangeDate: user.lastSecurityChange,
    };
  }
}