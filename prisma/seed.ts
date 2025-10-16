import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Gender, Role, Status, User } from 'src/auth/entities/user.entity';

// Konfigurasi koneksi database
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'your_username',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME || 'your_database',
  entities: [User],
  synchronize: true, // Hati-hati: ini akan menyesuaikan skema database
});

async function seed() {
  try {
    // Inisialisasi koneksi database
    await dataSource.initialize();
    console.log('Database connected successfully');

    const userRepository = dataSource.getRepository(User);

    // Data dummy untuk User
    const users = [
      {
        name: 'Ahmad Santoso',
        nim: '123456789',
        nip: undefined,
        email: 'ahmad.santoso@univ.ac.id',
        role: Role.MAHASISWA,
        gender: Gender.LAKI_LAKI,
        password: await bcrypt.hash('password123', 10),
        photo: 'https://example.com/photos/ahmad.jpg',
        status: Status.AKTIF,
        alamat: 'Jl. Merdeka No. 10, Jakarta',
        telepon: '081234567890',
        tanggalLahir: new Date('2000-05-15'),
      },
      {
        name: 'Siti Nurhaliza',
        nim: '987654321',
        nip: undefined,
        email: 'siti.nurhaliza@univ.ac.id',
        role: Role.MAHASISWA,
        gender: Gender.PEREMPUAN,
        password: await bcrypt.hash('password123', 10),
        photo: 'https://example.com/photos/siti.jpg',
        status: Status.AKTIF,
        alamat: 'Jl. Sudirman No. 25, Bandung',
        telepon: '082345678901',
        tanggalLahir: new Date('2001-08-20'),
      },
      {
        name: 'Dr. Budi Hartono',
        nim: undefined,
        nip: 'D001',
        email: 'budi.hartono@univ.ac.id',
        role: Role.DOSEN,
        gender: Gender.LAKI_LAKI,
        password: await bcrypt.hash('dosen123', 10),
        photo: 'https://example.com/photos/budi.jpg',
        status: Status.AKTIF,
        alamat: 'Jl. Gatot Subroto No. 5, Yogyakarta',
        telepon: '083456789012',
        tanggalLahir: new Date('1975-03-10'),
      },
      {
        name: 'Prof. Anita Sari',
        nim: undefined,
        nip: 'D002',
        email: 'anita.sari@univ.ac.id',
        role: Role.DOSEN,
        gender: Gender.PEREMPUAN,
        password: await bcrypt.hash('dosen123', 10),
        photo: 'https://example.com/photos/anita.jpg',
        status: Status.AKTIF,
        alamat: 'Jl. Diponegoro No. 15, Surabaya',
        telepon: '084567890123',
        tanggalLahir: new Date('1968-11-25'),
      },
      {
        name: 'Rudi Kurniawan',
        nim: '456789123',
        nip: undefined,
        email: 'rudi.kurniawan@univ.ac.id',
        role: Role.MAHASISWA,
        gender: Gender.LAKI_LAKI,
        password: await bcrypt.hash('password123', 10),
        photo: null,
        status: Status.CUTI,
        alamat: 'Jl. Veteran No. 30, Medan',
        telepon: '085678901234',
        tanggalLahir: new Date('1999-12-01'),
      },
    ];

    // Simpan data dummy ke database
    for (const user of users) {
      const existingUser = await userRepository.findOne({
        where: [
          { email: user.email },
          ...(user.nim ? [{ nim: user.nim }] : []),
          ...(user.nip ? [{ nip: user.nip }] : [])
        ],
      });
      if (!existingUser) {
        // Ensure 'nim', 'nip', and 'photo' are undefined instead of null
        const userToSave = {
          ...user,
          nim: user.nim ?? undefined,
          nip: user.nip ?? undefined,
          photo: user.photo ?? undefined,
        };
        await userRepository.save(userToSave);
        console.log(`User ${user.name} seeded successfully`);
      } else {
        console.log(`User ${user.name} already exists, skipping...`);
      }
    }

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    // Tutup koneksi database
    await dataSource.destroy();
    console.log('Database connection closed');
  }
}