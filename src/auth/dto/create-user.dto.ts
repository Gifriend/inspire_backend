import { Role, Gender, Status } from '../entities/user.entity';

export class CreateUserDto {
  name: string;
  nim?: string;
  nip?: string;
  email: string;
  role: Role;
  gender: Gender;
  password: string;
  photo?: string;
  status: Status;
  alamat?: string;
  telepon?: string;
  tanggalLahir?: Date;
  fakultasId: number;
  prodiId?: number;
}