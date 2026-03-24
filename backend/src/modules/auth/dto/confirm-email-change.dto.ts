import { IsEmail, IsString } from 'class-validator';

export class ConfirmEmailChangeDto {
  @IsEmail({}, { message: 'Invalid email format' })
  newEmail: string;

  @IsString()
  token: string;
}