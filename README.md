# InSpire Backend - Academic Management System

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## 📖 Description

InSpire Backend is a comprehensive Academic Management System API built with NestJS, TypeScript, and Prisma ORM. This system provides complete solutions for managing academic activities at Sam Ratulangi University, including course registration (KRS), attendance tracking, e-learning, announcements, and academic transcripts.

## ✨ Features

### 🎓 Academic Management
- **KHS (Semester Grade Report)**: View and download semester grade reports in JSON and HTML format
- **Transcript**: Generate academic transcripts with GPA calculation and grade filtering
- **GPA Calculation**: Automatic calculation of semester and cumulative GPA

### 📝 Course Registration (KRS)
- Draft KRS creation and management
- Add/remove courses with SKS validation
- KRS submission and approval workflow
- Lecturer and Program Coordinator approval system

### 📚 E-Learning
- Course session management
- Material upload (text, files, or hybrid)
- Assignment creation and submission with deadline validation
- Interactive quizzes with automatic scoring
- Quiz attempt tracking

### 👥 Attendance Management (Presensi)
- Token-based attendance system (8-character alphanumeric)
- Manual attendance input by lecturers
- Maximum 16 regular sessions per class
- Final exam attendance with 80% attendance threshold
- Real-time session opening/closing

### 📢 Announcements (Pengumuman)
- Class-specific announcements
- Global announcements (Program Coordinator only)
- Multi-class announcements support
- Automatic filtering for students based on registered classes

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (Student, Lecturer, Program Coordinator)
- Secure password hashing with bcrypt

## 🛠️ Tech Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Database ORM**: Prisma 7.x
- **Database**: PostgreSQL
- **Authentication**: JWT (Passport.js)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest
- **Password Hashing**: bcrypt

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **PostgreSQL**: v14.x or higher
- **Git**: Latest version

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd inspire_backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/inspire_db?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="24h"

# Application Configuration
PORT=3000
NODE_ENV=development
```

**Important**: Replace the placeholder values with your actual credentials.

### 4. Database Setup

#### Generate Prisma Client

```bash
npm run prisma:generate
```

#### Run Database Migrations

```bash
npx prisma migrate dev
```

This will create all necessary tables in your PostgreSQL database.

#### (Optional) Seed Database

If you have seed data:

```bash
npm run seed
```

### 5. Verify Database Connection

Check your database connection:

```bash
npx prisma studio
```

This opens Prisma Studio at `http://localhost:5555` to view your database.

## 🏃 Running the Application

### Development Mode

```bash
# Standard development mode
npm run start

# Watch mode (auto-restart on file changes)
npm run start:dev

# Debug mode
npm run start:debug
```

The server will start at `http://localhost:3000`

### Production Mode

```bash
# Build the application
npm run build

# Run production build
npm run start:prod
```

## 🧪 Testing

### Run All Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Test coverage
npm run test:cov
```

### Run Specific Test Suite

```bash
# Run the comprehensive test suite
npm run test:suite
```

### End-to-End Tests

```bash
npm run test:e2e
```

## 📁 Project Structure

```
inspire_backend/
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Database migrations
│   └── seed.ts                 # Database seeder
├── src/
│   ├── academic/               # Academic transcripts & KHS
│   │   ├── academic.controller.ts
│   │   ├── academic.service.ts
│   │   ├── academic.module.ts
│   │   └── dto/
│   ├── auth/                   # Authentication & Authorization
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── dto/
│   │   └── strategy/
│   ├── krs/                    # Course Registration System
│   │   ├── krs.controller.ts
│   │   ├── krs.service.ts
│   │   ├── krs.module.ts
│   │   └── dto/
│   ├── elearning/              # E-Learning Management
│   │   ├── elearning.controller.ts
│   │   ├── elearning.service.ts
│   │   ├── elearning.module.ts
│   │   └── dto/
│   ├── presensi/               # Attendance System
│   │   ├── presensi.controller.ts
│   │   ├── presensi.service.ts
│   │   ├── presensi.module.ts
│   │   └── dto/
│   ├── pengumuman/             # Announcements
│   │   ├── pengumuman.controller.ts
│   │   ├── pengumuman.service.ts
│   │   ├── pengumuman.module.ts
│   │   └── dto/
│   ├── prisma/                 # Prisma Service
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   ├── common/                 # Shared utilities
│   │   ├── decorators/
│   │   └── middleware/
│   ├── app.module.ts           # Root module
│   └── main.ts                 # Application entry point
├── test/                       # Test files
├── .env                        # Environment variables
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## 🔑 API Endpoints

### Authentication

```
POST   /auth/login              # User login
POST   /auth/register           # User registration
POST   /auth/refresh            # Refresh access token
GET    /auth/profile            # Get current user profile
```

### Academic

```
GET    /academic/transkrip/:id        # Get academic transcript
GET    /academic/transkrip/:id/html   # Download transcript as HTML
GET    /academic/khs/:id               # Get semester grade report
GET    /academic/khs/:id/html          # Download KHS as HTML
```

### Course Registration (KRS)

```
GET    /krs/:semester                  # Get KRS for semester
POST   /krs/add-class                  # Add class to KRS
POST   /krs/submit                     # Submit KRS for approval
POST   /krs/:id/approve                # Approve KRS (Lecturer only)
POST   /krs/:id/reject                 # Reject KRS (Lecturer only)
```

### E-Learning

```
POST   /elearning/session              # Create course session
POST   /elearning/material             # Upload course material
POST   /elearning/assignment           # Create assignment
POST   /elearning/assignment/submit    # Submit assignment
POST   /elearning/quiz                 # Create quiz
POST   /elearning/quiz/submit          # Submit quiz answers
GET    /elearning/course/:id           # Get course content
```

### Attendance (Presensi)

```
POST   /presensi/session               # Create attendance session (Lecturer)
POST   /presensi/submit                # Submit attendance via token (Student)
POST   /presensi/manual                # Manual attendance input (Lecturer)
GET    /presensi/session/:id           # Get session details
PATCH  /presensi/session/:id/close     # Close attendance session
```

### Announcements (Pengumuman)

```
POST   /pengumuman                     # Create announcement
GET    /pengumuman                     # Get announcements (filtered by role)
GET    /pengumuman/:id                 # Get specific announcement
PUT    /pengumuman/:id                 # Update announcement
DELETE /pengumuman/:id                 # Delete announcement
```

## 👥 User Roles & Permissions

### Student (MAHASISWA)
- View and download transcripts/KHS
- Create and submit KRS
- Submit attendance via token
- Access e-learning materials
- Submit assignments and quizzes
- View class-specific announcements

### Lecturer (DOSEN)
- Create attendance sessions
- Manual attendance input
- Create e-learning content
- Approve/reject KRS
- Create class announcements
- Grade assignments

### Program Coordinator (KOORPRODI)
- All lecturer permissions
- Create global announcements
- Create multi-class announcements
- Approve KRS across multiple classes

## 🔒 Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Input validation and sanitization
- SQL injection protection via Prisma
- Environment variable protection

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U username -d inspire_db
```

### Port Already in Use

```bash
# Kill process using port 3000
npx kill-port 3000

# Or change port in .env
PORT=3001
```

### Prisma Client Issues

```bash
# Regenerate Prisma Client
npx prisma generate

# Reset database (CAUTION: Deletes all data)
npx prisma migrate reset
```

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the UNLICENSED License.

## 📧 Contact & Support

For questions and support, please contact the development team.

---

**Built with ❤️ using NestJS**
