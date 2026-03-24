import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { BaseService } from './base.service';
import { BaseEntity } from './base.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

export abstract class BaseController<T extends BaseEntity> {
  constructor(protected readonly service: BaseService<T>) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createDto: any): Promise<T> {
    return this.service.create(createDto);
  }

  @Get()
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    if (page && limit) {
      return this.service.findAllWithPagination(+page, +limit);
    }
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<T> {
    return this.service.findById(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateDto: any): Promise<T> {
    return this.service.update(+id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.delete(+id);
  }
}