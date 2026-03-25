import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';
import { User } from '../../user/entities/user.entity';
import { TokenType } from 'src/common/constants/token-type.enum';

@Entity('user_tokens')
export class UserToken extends BaseEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ length: 255 })
  token: string;

  @Column({ type: 'nvarchar', length: 50 })
  type: TokenType;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'metadata', type: 'nvarchar', nullable: true })
  metadata: string | null;

  @Column({ name: 'is_approved', type: 'bit', default: false })
  isApproved: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}