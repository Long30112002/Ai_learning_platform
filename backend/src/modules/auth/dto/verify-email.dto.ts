import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  token: string;
}