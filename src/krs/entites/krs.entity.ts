// src/krs/entities/krs.entity.ts
import { User } from 'src/auth/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';

export enum StatusKRS {
  DRAFT = 'DRAFT',
  DIAJUKAN = 'DIAJUKAN',
  DISETUJUI = 'DISETUJUI',
  DITOLAK = 'DITOLAK',
}

@Entity()
export class KRS {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  semester: string;

  @Column({ type: 'enum', enum: StatusKRS, default: StatusKRS.DRAFT })
  status: StatusKRS;

  @Column({ default: 0 })
  totalSKS: number;

  @Column({ type: 'timestamp', nullable: true })
  tanggalPengajuan: Date;

  @Column({ type: 'timestamp', nullable: true })
  tanggalPersetujuan: Date;

  @Column({ nullable: true })
  catatanDosen: string;

  @ManyToOne(() => User, (user) => user.krs)
  @JoinColumn({ name: 'mahasiswaId' })
  mahasiswa: User;

  @Column()
  mahasiswaId: number;

  // Simpan kelas sebagai array JSON sederhana
  @Column('simple-json', { nullable: true })
  kelasTerpilih: {
    kelasId: number;
    kodeMataKuliah: string;
    namaMataKuliah: string;
    sks: number;
    dosen: string;
    kapasitas: number;
  }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}