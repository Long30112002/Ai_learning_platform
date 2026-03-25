import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { RoleService } from './role.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Role } from '../../common/constants/roles.enum';
import { Permission } from '../../common/constants/permissions.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UserController {
  constructor(
    private userService: UserService,
    private roleService: RoleService,
  ) {}

  @Get()
  @Roles(Role.ADMIN)
  @Permissions(Permission.USER_LIST)
  async findAll() {
    return this.userService.findAll();
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.userService.findById(user.id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.INSTRUCTOR)
  @Permissions(Permission.USER_VIEW)
  async findOne(@Param('id') id: string) {
    return this.userService.findById(+id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @Permissions(Permission.USER_UPDATE)
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.userService.update(+id, updateData);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @Permissions(Permission.USER_DELETE)
  async delete(@Param('id') id: string) {
    return this.userService.delete(+id);
  }

  @Post(':id/roles')
  @Roles(Role.ADMIN)
  @Permissions(Permission.ROLE_MANAGE)
  async assignRole(@Param('id') id: string, @Body('roleId') roleId: number) {
    return this.userService.assignRole(+id, roleId);
  }

  @Get(':id/permissions')
  @Roles(Role.ADMIN)
  async getUserPermissions(@Param('id') id: string) {
    const user = await this.userService.findById(+id);
    return this.roleService.getPermissionsByRole(user.roleId);
  }
}