import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { UserToken } from '../../auth/entities/user-token.entity';
import { Role } from './role.entity';
import { UserAccessLevel } from 'src/common/constants/user-access-level.enum';
import { UserLog } from 'src/modules/auth/entities/user-log.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ name: 'full_name', length: 255, nullable: true })
  fullName: string;

  @Column({ name: 'role_id', type: 'int' })
  roleId: number;

  @Column({ name: 'is_active', type: 'bit', default: false })
  isActive: boolean;

  @Column({ name: 'is_email_verified', type: 'bit', default: false })
  isEmailVerified: boolean;

  @Column({
    name: 'access_level',
    type: 'nvarchar',
    length: 20,
    default: UserAccessLevel.FULL
  })
  accessLevel: UserAccessLevel;

  @Column({ name: 'previous_email', type: 'nvarchar', length: 255, nullable: true })
  previousEmail: string | null;

  @Column({ name: 'recovery_expires_at', type: 'datetime', nullable: true })
  recoveryExpiresAt: Date | null;

  @Column({ name: 'last_security_change', type: 'datetime', nullable: true })
  lastSecurityChange: Date | null;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => RefreshToken, refreshToken => refreshToken.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => UserToken, userToken => userToken.user)
  userTokens: UserToken[];

  @OneToMany(() => UserLog, userLog => userLog.user)
  userLogs: UserLog[];
}