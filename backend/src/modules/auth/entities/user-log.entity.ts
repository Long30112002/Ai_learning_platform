import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';
import { User } from '../../user/entities/user.entity';

@Entity('user_logs')
export class UserLog extends BaseEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'old_value', type: 'nvarchar', nullable: true })
  oldValue: string | null;

  @Column({ name: 'new_value', type: 'nvarchar', nullable: true })
  newValue: string | null;

  @Column({ type: 'nvarchar', nullable: true })
  metadata: string | null;

  @Column({ name: 'ip_address', type: 'nvarchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'nvarchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ name: 'recovery_token', type: 'nvarchar', length: 255, nullable: true })
  recoveryToken: string | null;

  @Column({ name: 'recovery_expires_at', type: 'datetime', nullable: true })
  recoveryExpiresAt: Date | null;

  @Column({ name: 'recovery_used', type: 'bit', default: false })
  recoveryUsed: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}