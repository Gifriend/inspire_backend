// ==========================================
// DTOs (Data Transfer Objects)
// ==========================================

export class CreateSessionDto {
  title: string;
  description?: string;
  weekNumber: number;
  kelasPerkuliahanId: number;
}

export class CreateMaterialDto {
  title: string;
  type: 'TEXT' | 'FILE' | 'HYBRID';
  content?: string;
  fileUrl?: string;
  sessionId: string;
}

export class CreateAssignmentDto {
  title: string;
  description?: string;
  deadline: string; // ISO Date String
  sessionId: string;
}

export class SubmitAssignmentDto {
  assignmentId: string;
  studentId: number;
  fileUrl?: string;
  textContent?: string;
}

export class CreateQuestionDto {
  text: string;
  type: 'MULTIPLE_CHOICE' | 'ESSAY' | 'TRUE_FALSE';
  options?: any; // JSON array ["A", "B"]
  correctAnswer: string;
  points: number;
}

export class CreateQuizDto {
  title: string;
  duration: number; // menit
  startTime: string;
  endTime: string;
  gradingMethod: 'HIGHEST_GRADE' | 'LATEST_GRADE' | 'AVERAGE_GRADE';
  sessionId: string;
  questions: CreateQuestionDto[];
}