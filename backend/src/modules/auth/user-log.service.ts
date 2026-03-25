import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UserLog } from './entities/user-log.entity';
import { UserLogAction } from 'src/common/constants/user-log-action.enum';

@Injectable()
export class UserLogService {
  private readonly logger = new Logger(UserLogService.name);

  constructor(
    @InjectRepository(UserLog)
    private userLogRepository: Repository<UserLog>,
  ) { }

  async log(
    userId: number,
    action: UserLogAction,
    options?: {
      oldValue?: any;
      newValue?: any;
      metadata?: any;
      ipAddress?: string;
      userAgent?: string;
      recoveryToken?: string; 
      recoveryExpiresAt?: Date;
    },
  ): Promise<void> {
    try {
      const log = this.userLogRepository.create({
        userId,
        action,
        oldValue: options?.oldValue ? JSON.stringify(options.oldValue) : null,
        newValue: options?.newValue ? JSON.stringify(options.newValue) : null,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
        ipAddress: options?.ipAddress || null,
        userAgent: options?.userAgent || null,
        recoveryToken: options?.recoveryToken || null,
        recoveryExpiresAt: options?.recoveryExpiresAt || null,
        recoveryUsed: false,
      });
      await this.userLogRepository.save(log);
      this.logger.debug(`Logged action ${action} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to log action ${action} for user ${userId}:`, error);
    }
  }

  async getUserLogs(
    userId: number,
    action?: UserLogAction,
    limit: number = 50,
  ): Promise<UserLog[]> {
    const query = this.userLogRepository.createQueryBuilder('log')
      .where('log.user_id = :userId', { userId })
      .orderBy('log.created_at', 'DESC')
      .take(limit);

    if (action) {
      query.andWhere('log.action = :action', { action });
    }

    return query.getMany();
  }

  async findEmailChangeLogByRecoveryToken(token: string): Promise<UserLog | null> {
    return await this.userLogRepository.findOne({
      where: {
        recoveryToken: token,
        recoveryUsed: false,
        recoveryExpiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findEmailChangeLogByApprovalToken(approvalToken: string): Promise<UserLog | null> {
    return await this.userLogRepository.findOne({
      where: {
        action: UserLogAction.EMAIL_CHANGE_REQUEST,
        recoveryToken: approvalToken,
        recoveryUsed: false,
        recoveryExpiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async markRecoveryTokenUsed(id: number): Promise<void> {
    await this.userLogRepository.update(id, { recoveryUsed: true });
  }
}