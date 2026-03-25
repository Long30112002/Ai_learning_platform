import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../common/base/base.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { UserAccessLevel } from 'src/common/constants/user-access-level.enum';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {
    super(userRepository);
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role'],
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findAllWithRoles(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['role'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  async assignRole(userId: number, roleId: number): Promise<User> {
    const user = await this.findById(userId);
    
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });
    
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    user.roleId = roleId;
    return this.userRepository.save(user);
  }

  async findByRole(roleId: number): Promise<User[]> {
    return this.userRepository.find({
      where: { roleId },
      relations: ['role'],
    });
  }

  async updateAccessLevel(userId: number, accessLevel: UserAccessLevel): Promise<User> {
    const user = await this.findById(userId);
    user.accessLevel = accessLevel;
    return this.userRepository.save(user);
  }

  async lockAccount(userId: number): Promise<User> {
    const user = await this.findById(userId);
    user.isActive = false;
    user.accessLevel = UserAccessLevel.SUSPENDED;
    return this.userRepository.save(user);
  }

  async unlockAccount(userId: number): Promise<User> {
    const user = await this.findById(userId);
    user.isActive = true;
    user.accessLevel = UserAccessLevel.FULL;
    return this.userRepository.save(user);
  }
}