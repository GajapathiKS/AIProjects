import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Goal, NeedsAssessment, ProgressUpdate, StudentDetail, StudentSummary } from '../models/student';

@Injectable({ providedIn: 'root' })
export class ProgramService {
  private http = inject(HttpClient);

  getStudents(): Observable<StudentSummary[]> {
    return this.http.get<StudentSummary[]>(`/api/students`);
  }

  getStudent(id: string): Observable<StudentDetail> {
    return this.http.get<StudentDetail>(`/api/students/${id}`);
  }

  createStudent(payload: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gradeLevel: string;
    campus: string;
    guardianContact: string;
    programFocus: string;
    localId: string;
    enrollmentDate: string;
    nextReviewDate?: string | null;
  }): Observable<StudentSummary> {
    return this.http.post<StudentSummary>(`/api/students`, payload);
  }

  updateStudent(id: string, payload: Parameters<ProgramService['createStudent']>[0]): Observable<StudentSummary> {
    return this.http.put<StudentSummary>(`/api/students/${id}`, payload);
  }

  deleteStudent(id: string): Observable<void> {
    return this.http.delete<void>(`/api/students/${id}`);
  }

  getNeeds(studentId: string): Observable<NeedsAssessment[]> {
    return this.http.get<NeedsAssessment[]>(`/api/needsassessments/student/${studentId}`);
  }

  createNeeds(payload: {
    studentId: string;
    academicNeeds: string;
    supportServices: string;
    instructionalStrategies: string;
    assessmentTools: string;
  }): Observable<NeedsAssessment> {
    return this.http.post<NeedsAssessment>(`/api/needsassessments`, payload);
  }

  updateNeeds(id: string, payload: Omit<Parameters<ProgramService['createNeeds']>[0], 'studentId'>): Observable<NeedsAssessment> {
    return this.http.put<NeedsAssessment>(`/api/needsassessments/${id}`, payload);
  }

  getGoals(studentId: string): Observable<Goal[]> {
    return this.http.get<Goal[]>(`/api/goals/student/${studentId}`);
  }

  createGoal(payload: {
    studentId: string;
    description: string;
    category: string;
    measurement: string;
    owner: string;
    targetDate: string;
  }): Observable<Goal> {
    return this.http.post<Goal>(`/api/goals`, payload);
  }

  updateGoal(goalId: string, payload: {
    description: string;
    category: string;
    measurement: string;
    owner: string;
    targetDate: string;
    status: string;
  }): Observable<Goal> {
    return this.http.put<Goal>(`/api/goals/${goalId}`, payload);
  }

  updateGoalStatus(goalId: string, status: string): Observable<void> {
    return this.http.patch<void>(`/api/goals/${goalId}/status`, { status });
  }

  deleteGoal(goalId: string): Observable<void> {
    return this.http.delete<void>(`/api/goals/${goalId}`);
  }

  getProgress(goalId: string): Observable<ProgressUpdate[]> {
    return this.http.get<ProgressUpdate[]>(`/api/goals/${goalId}/progress`);
  }

  addProgress(goalId: string, payload: {
    summary: string;
    outcome: string;
    evidenceUrl: string;
    nextAction: string;
    recordedBy: string;
  }): Observable<ProgressUpdate> {
    return this.http.post<ProgressUpdate>(`/api/goals/${goalId}/progress`, { ...payload, goalId });
  }

  updateProgress(goalId: string, progressId: string, payload: Parameters<ProgramService['addProgress']>[1]): Observable<ProgressUpdate> {
    return this.http.put<ProgressUpdate>(`/api/goals/${goalId}/progress/${progressId}`, { ...payload, goalId });
  }

  deleteProgress(goalId: string, progressId: string): Observable<void> {
    return this.http.delete<void>(`/api/goals/${goalId}/progress/${progressId}`);
  }

  getAdminSummary(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`/api/admin/dashboard`);
  }
}
