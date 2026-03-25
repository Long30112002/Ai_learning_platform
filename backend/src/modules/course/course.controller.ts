import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Role } from '../../common/constants/roles.enum';
import { Permission } from '../../common/constants/permissions.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('courses')
export class CourseController {
  
  @Get()
  @Permissions(Permission.COURSE_VIEW)
  async findAll() {
    // Anyone with COURSE_VIEW permission can view courses
    return [];
  }

  @Post()
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Permissions(Permission.COURSE_CREATE)
  async create(@Body() data: any, @CurrentUser() user: any) {
    // Only INSTRUCTOR or ADMIN can create courses
    return { message: 'Course created', userId: user.id };
  }

  @Put(':id')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Permissions(Permission.COURSE_UPDATE)
  async update(@Param('id') id: string, @Body() data: any) {
    return { message: `Course ${id} updated` };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @Permissions(Permission.COURSE_DELETE)
  async delete(@Param('id') id: string) {
    return { message: `Course ${id} deleted` };
  }

  @Post(':id/publish')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Permissions(Permission.COURSE_PUBLISH)
  async publish(@Param('id') id: string) {
    return { message: `Course ${id} published` };
  }
}