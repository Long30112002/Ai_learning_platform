import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';
import { User } from './user.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ length: 50 })
  name: string;

  @OneToMany(() => User, user => user.role)
  users: User[];
}