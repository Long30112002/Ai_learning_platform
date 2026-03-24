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

  async sendVerificationOTP(email: string, otp: string, fullName?: string): Promise<boolean> {
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
      return true;
    } catch (error) {
      this.logger.error(`Failed to send verification OTP to ${email}:`, error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, fullName?: string): Promise<boolean> {
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
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, token: string, fullName?: string, metadata?: any): Promise<boolean> {
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
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      return false;
    }
  }

  async sendEmailChangeAlert(oldEmail: string, newEmail: string, fullName?: string): Promise<boolean> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const securityUrl = `${frontendUrl}/security/email-change-revoke`;

    try {
      await this.mailerService.sendMail({
        to: oldEmail,
        subject: `⚠️ SECURITY ALERT: Email Change Requested - ${appName}`,
        template: './email-change-alert',
        context: {
          name: fullName || oldEmail.split('@')[0],
          newEmail,
          appName,
          securityUrl,
          supportUrl: this.configService.get('SUPPORT_URL', 'mailto:support@example.com'),
          requestTime: new Date().toLocaleString('vi-VN'),
        },
      });
      this.logger.log(`Email change alert sent to ${oldEmail} for new email ${newEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email change alert to ${oldEmail}:`, error);
      return false;
    }
  }

  async sendEmailChangeOTP(newEmail: string, otp: string, fullName?: string): Promise<boolean> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');

    try {
      await this.mailerService.sendMail({
        to: newEmail,
        subject: `Verify Your New Email - ${appName}`,
        template: './verification-otp',
        context: {
          name: fullName || newEmail.split('@')[0],
          otp,
          appName,
          expiryMinutes: 15,
        },
      });
      this.logger.log(`Email change OTP sent to new email: ${newEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email change OTP to ${newEmail}:`, error);
      return false;
    }
  }

  async sendEmailChangeCompleteNew(newEmail: string, fullName?: string): Promise<boolean> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');
    const loginUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000') + '/login';

    try {
      await this.mailerService.sendMail({
        to: newEmail,
        subject: `Email Changed Successfully - ${appName}`,
        template: './email-change-complete-new',
        context: {
          name: fullName || newEmail.split('@')[0],
          email: newEmail,
          loginUrl,
          appName,
          supportUrl: this.configService.get('SUPPORT_URL', 'mailto:support@example.com'),
        },
      });
      this.logger.log(`Email change completion sent to new email: ${newEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email change completion to new email ${newEmail}:`, error);
      return false;
    }
  }

  async sendEmailChangeCompleteOld(oldEmail: string, newEmail: string, fullName?: string): Promise<boolean> {
    const appName = this.configService.get('APP_NAME', 'AI Learning Platform');
    const loginUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000') + '/login';

    try {
      await this.mailerService.sendMail({
        to: oldEmail,
        subject: `Email Address Changed - ${appName}`,
        template: './email-change-complete-old',
        context: {
          name: fullName || oldEmail.split('@')[0],
          oldEmail,
          newEmail,
          loginUrl,
          appName,
          supportUrl: this.configService.get('SUPPORT_URL', 'mailto:support@example.com'),
        },
      });
      this.logger.log(`Email change completion sent to old email: ${oldEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email change completion to old email ${oldEmail}:`, error);
      return false;
    }
  }

  async sendEmailChangeCompletion(oldEmail: string, newEmail: string, fullName?: string): Promise<void> {
    await this.sendEmailChangeCompleteNew(newEmail, fullName);
    await this.sendEmailChangeCompleteOld(oldEmail, newEmail, fullName);
  }
}