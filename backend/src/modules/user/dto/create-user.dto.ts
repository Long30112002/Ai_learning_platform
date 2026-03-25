import { IsEmail, IsString, MinLength, IsOptional, IsInt } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsString()
    @IsOptional()
    fullName?: string;

    @IsInt()
    @IsOptional()
    roleId?: number;
}