import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  async sendVerificationOTP(email: string, otp: string, fullName?: string): Promise<void> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Your Verification Code - ${appName}`,
        template: './verification-otp',
        context: {
          name: fullName || email.split('@')[0],
          otp,
          appName,
          expiryMinutes: 15,
        },
      });
      this.logger.log(`Verification OTP sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification OTP to ${email}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullName?: string): Promise<void> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Welcome to ${appName}!`,
        template: './welcome',
        context: {
          name: fullName || email.split('@')[0],
          appName,
          loginUrl: this.configService.get('FRONTEND_URL', 'http://localhost:3000') + '/login',
        },
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
    }
  }

  async sendPasswordResetEmail(email: string, token: string, fullName?: string, metadata?: any): Promise<void> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Password Reset Request - ${appName}`,
        template: './password-reset',
        context: {
          name: fullName || email.split('@')[0],
          resetUrl,
          appName,
          expiryMinutes: 15,
          deviceInfo: metadata?.deviceInfo || 'Unknown device',
          location: metadata?.location || 'Unknown location',
        },
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  async sendEmailChangeNotification(oldEmail: string, newEmail: string, fullName?: string): Promise<void> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');

    try {
      await this.mailerService.sendMail({
        to: oldEmail,
        subject: `Email Address Changed - ${appName}`,
        template: './email-changed',
        context: {
          name: fullName || oldEmail.split('@')[0],
          newEmail,
          appName,
          supportUrl: this.configService.get('SUPPORT_URL', 'mailto:support@example.com'),
        },
      });
      this.logger.log(`Email change notification sent to ${oldEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send email change notification to ${oldEmail}:`, error);
    }
  }
}