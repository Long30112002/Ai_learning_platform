import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
  ) { }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      fullName: registerDto.fullName,
      roleId: 1,
    } as Partial<User>);

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshTokenString: string) {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
      relations: ['user'],
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      await this.refreshTokenRepository.delete(refreshToken.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!refreshToken.user.isActive) {
      await this.refreshTokenRepository.delete(refreshToken.id);
      throw new UnauthorizedException('User account is disabled');
    }

    const tokens = await this.generateTokens(refreshToken.user);
    await this.refreshTokenRepository.delete(refreshToken.id);

    return tokens;
  }

  async logout(userId: number, refreshTokenString?: string) {
    if (refreshTokenString) {
      await this.refreshTokenRepository.delete({
        userId,
        token: refreshTokenString,
      });
    } else {
      await this.refreshTokenRepository.delete({ userId });
    }

    return { message: 'Logged out successfully' };
  }

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId
    };

    // SỬA: Dùng số giây thay vì string '15m' để tránh lỗi type
    const accessTokenExpiresIn = 60 * 15; // 15 phút = 900 giây
    const refreshTokenExpiresIn = 60 * 60 * 24 * 7; // 7 ngày = 604800 giây

    const [accessToken, refreshTokenString] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: refreshTokenExpiresIn,
      }),
    ]);

    // Tính ngày hết hạn
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 ngày

    const refreshToken = this.refreshTokenRepository.create({
      userId: user.id,
      token: refreshTokenString,
      expiresAt,
    });
    await this.refreshTokenRepository.save(refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenString
    };
  }

  async cleanupExpiredTokens() {
    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}