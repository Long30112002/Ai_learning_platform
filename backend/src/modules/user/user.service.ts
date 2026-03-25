import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../common/base/base.service';
import { User } from './entities/user.entity';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super(userRepository);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { email },
      relations: ['role'],
    });
  }

  async findWithRole(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['role'],
    });
  }
}