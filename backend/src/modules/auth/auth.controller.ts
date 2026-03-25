import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Get } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private tokenService: TokenService,
  ) { }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    return this.authService.register(registerDto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() resendVerificationDto: ResendVerificationDto, @Req() req: Request) {
    return this.authService.resendVerification(resendVerificationDto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.logout(user.id, refreshToken);
  }

  @Post('change-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changeEmail(
    @CurrentUser() user: any,
    @Body() changeEmailDto: ChangeEmailDto,
    @Req() req: Request,
  ) {
    return this.authService.changeEmail(user.id, changeEmailDto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('confirm-email-change')
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(@Body() confirmEmailChangeDto: ConfirmEmailChangeDto) {
    return this.authService.confirmEmailChange(confirmEmailChangeDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(forgotPasswordDto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      location: req.headers['cf-ipcountry'] || 'Unknown',
    });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('revoke-email-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeEmailChange(@CurrentUser() user: any) {
    await this.tokenService.revokeEmailChangeRequests(user.id);
    return {
      message: 'All pending email change requests have been cancelled. Your account is secure.',
    };
  }

  @Get('check-sensitive-action')
  @UseGuards(JwtAuthGuard)
  async checkSensitiveAction(
    @CurrentUser() user: any,
    @Body('action') actionName: string,
  ) {
    return this.authService.performSensitiveAction(user.id, actionName);
  }
  @Public()
  @Post('secure-my-account')
  @HttpCode(HttpStatus.OK)
  async secureMyAccount(
    @Body('userId') userId: number,
    @Body('token') token: string,
    @Req() req: Request,
  ) {
    return this.authService.secureMyAccount(userId, token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('approve-email-change')
  @HttpCode(HttpStatus.OK)
  async approveEmailChange(
    @Body('token') token: string,
    @Body('changeToken') changeToken: string,
  ) {
    return this.authService.approveEmailChange(token, changeToken);
  }
}