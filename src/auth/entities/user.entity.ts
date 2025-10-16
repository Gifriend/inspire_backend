import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum Role {
  MAHASISWA = 'MAHASISWA',
  DOSEN = 'DOSEN',
}

export enum Gender {
  LAKI_LAKI = 'LAKI_LAKI',
  PEREMPUAN = 'PEREMPUAN',
}

export enum Status {
  AKTIF = 'AKTIF',
  CUTI = 'CUTI',
  NON_AKTIF = 'NON_AKTIF',
  LULUS = 'LULUS',
  DROP_OUT = 'DROP_OUT',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true, unique: true })
  nim: string;

  @Column({ nullable: true, unique: true })
  nip: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column()
  password: string;

  @Column({ nullable: true })
  photo: string;

  @Column({ type: 'enum', enum: Status })
  status: Status;

  @Column({ nullable: true })
  alamat: string;

  @Column({ nullable: true })
  telepon: string;

  @Column({ type: 'date', nullable: true })
  tanggalLahir: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}