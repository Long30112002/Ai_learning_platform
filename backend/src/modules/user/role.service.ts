import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Role as RoleEnum, RoleNames } from '../../common/constants/roles.enum';
import { Permission, RolePermissions } from '../../common/constants/permissions.enum';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  async findById(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { name } });
  }

  async getPermissionsByRole(roleId: number): Promise<Permission[]> {
    const role = await this.findById(roleId);
    return RolePermissions[role.id as RoleEnum] || [];
  }

  async hasPermission(userId: number, permission: Permission): Promise<boolean> {
    // This would be implemented with user repository
    // For now, we check via role
    return true;
  }

  async initializeDefaultRoles(): Promise<void> {
    for (const [roleId, roleName] of Object.entries(RoleNames)) {
      const existing = await this.roleRepository.findOne({
        where: { name: roleName },
      });
      
      if (!existing) {
        await this.roleRepository.save({
          id: parseInt(roleId),
          name: roleName,
        });
      }
    }
  }
}