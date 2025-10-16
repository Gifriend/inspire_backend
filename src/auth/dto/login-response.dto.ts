import { Role } from "generated/prisma";

export class LoginResponseDto {
  access_token: string;
  refresh_token: string;
}