import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../constants/permissions.enum';
import { Role, RoleHierarchy } from '../constants/roles.enum';

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check by role (fast path)
    const userRole = user.roleId as Role;
    const userPermissions = this.getPermissionsByRole(userRole);
    
    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You don't have permission to perform this action. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }

  private getPermissionsByRole(role: Role): Permission[] {
    // Import dynamically to avoid circular dependency
    const { RolePermissions } = require('../constants/permissions.enum');
    return RolePermissions[role] || [];
  }
}