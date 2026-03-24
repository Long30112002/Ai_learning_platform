import { Repository, DeepPartial, FindManyOptions, FindOneOptions } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { BaseEntity } from './base.entity';

export abstract class BaseService<T extends BaseEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  async create(createDto: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(createDto);
    return await this.repository.save(entity);
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options);
  }

  async findAllWithPagination(
    page: number = 1,
    limit: number = 10,
    options?: FindManyOptions<T>
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.repository.findAndCount({
      skip,
      take: limit,
      ...options,
    });
    return { data, total, page, limit };
  }

  async findById(id: number, options?: FindOneOptions<T>): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id } as any,
      ...options,
    });
    if (!entity) {
      throw new NotFoundException(`${this.repository.metadata.name} with ID ${id} not found`);
    }
    return entity;
  }

  async update(id: number, updateDto: DeepPartial<T>): Promise<T> {
    await this.findById(id);
    await this.repository.update(id, updateDto as any);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    const entity = await this.findById(id);
    await this.repository.remove(entity);
  }

  async softDelete(id: number): Promise<void> {
    await this.repository.softDelete(id);
  }
}