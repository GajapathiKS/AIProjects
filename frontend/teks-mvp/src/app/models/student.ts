export interface StudentSummary {
  id: string;
  localId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  campus: string;
  programFocus: string;
  enrollmentDate: string;
  nextReviewDate?: string;
  needsAssessments: number;
  goals: number;
  activeGoals: number;
}

export interface StudentDetail {
  id: string;
  localId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  campus: string;
  programFocus: string;
  enrollmentDate: string;
  nextReviewDate?: string;
  dateOfBirth: string;
  guardianContact: string;
  needsAssessments: NeedsAssessment[];
  goals: GoalDetail[];
}

export interface NeedsAssessment {
  id: string;
  studentId: string;
  academicNeeds: string;
  supportServices: string;
  instructionalStrategies: string;
  assessmentTools: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  studentId: string;
  description: string;
  category: string;
  measurement: string;
  owner: string;
  targetDate: string;
  status: string;
}

export interface GoalDetail extends Goal {
  progressUpdates: ProgressUpdate[];
}

export interface ProgressUpdate {
  id: string;
  goalId: string;
  summary: string;
  outcome: string;
  evidenceUrl: string;
  nextAction: string;
  recordedBy: string;
  recordedAt: string;
}
