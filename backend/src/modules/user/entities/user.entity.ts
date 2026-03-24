import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { UserToken } from '../../auth/entities/user-token.entity';
import { Role } from './role.entity';

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

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => RefreshToken, refreshToken => refreshToken.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => UserToken, userToken => userToken.user)
  userTokens: UserToken[];
}