import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE } from '../api.config';
import { Observable } from 'rxjs';
import { Goal, NeedsAssessment, ProgressUpdate, StudentDetail, StudentSummary, Assignment } from '../models/student';

@Injectable({ providedIn: 'root' })
export class ProgramService {
  private http = inject(HttpClient);

  getStudents(): Observable<StudentSummary[]> {
  return this.http.get<StudentSummary[]>(`${API_BASE}/api/students`);
  }

  getStudent(id: string): Observable<StudentDetail> {
  return this.http.get<StudentDetail>(`${API_BASE}/api/students/${id}`);
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
  return this.http.post<StudentSummary>(`${API_BASE}/api/students`, payload);
  }

  updateStudent(id: string, payload: Parameters<ProgramService['createStudent']>[0]): Observable<StudentSummary> {
  return this.http.put<StudentSummary>(`${API_BASE}/api/students/${id}`, payload);
  }

  deleteStudent(id: string): Observable<void> {
  return this.http.delete<void>(`${API_BASE}/api/students/${id}`);
  }

  getNeeds(studentId: string): Observable<NeedsAssessment[]> {
  return this.http.get<NeedsAssessment[]>(`${API_BASE}/api/needsassessments/student/${studentId}`);
  }

  createNeeds(payload: {
    studentId: string;
    academicNeeds: string;
    supportServices: string;
    instructionalStrategies: string;
    assessmentTools: string;
  }): Observable<NeedsAssessment> {
  return this.http.post<NeedsAssessment>(`${API_BASE}/api/needsassessments`, payload);
  }

  updateNeeds(id: string, payload: Omit<Parameters<ProgramService['createNeeds']>[0], 'studentId'>): Observable<NeedsAssessment> {
  return this.http.put<NeedsAssessment>(`${API_BASE}/api/needsassessments/${id}`, payload);
  }

  getGoals(studentId: string): Observable<Goal[]> {
  return this.http.get<Goal[]>(`${API_BASE}/api/goals/student/${studentId}`);
  }

  getGoal(goalId: string): Observable<Goal> {
  return this.http.get<Goal>(`${API_BASE}/api/goals/${goalId}`);
  }

  createGoal(payload: {
    studentId: string;
    description: string;
    category: string;
    measurement: string;
    owner: string;
    targetDate: string;
  }): Observable<Goal> {
  return this.http.post<Goal>(`${API_BASE}/api/goals`, payload);
  }

  updateGoal(goalId: string, payload: {
    description: string;
    category: string;
    measurement: string;
    owner: string;
    targetDate: string;
    status: string;
  }): Observable<Goal> {
  return this.http.put<Goal>(`${API_BASE}/api/goals/${goalId}`, payload);
  }

  updateGoalStatus(goalId: string, status: string): Observable<void> {
  return this.http.patch<void>(`${API_BASE}/api/goals/${goalId}/status`, { status });
  }

  deleteGoal(goalId: string): Observable<void> {
  return this.http.delete<void>(`${API_BASE}/api/goals/${goalId}`);
  }

  getProgress(goalId: string): Observable<ProgressUpdate[]> {
  return this.http.get<ProgressUpdate[]>(`${API_BASE}/api/goals/${goalId}/progress`);
  }

  addProgress(goalId: string, payload: {
    summary: string;
    outcome: string;
    evidenceUrl: string;
    nextAction: string;
    recordedBy: string;
  }): Observable<ProgressUpdate> {
  return this.http.post<ProgressUpdate>(`${API_BASE}/api/goals/${goalId}/progress`, { ...payload, goalId });
  }

  updateProgress(goalId: string, progressId: string, payload: Parameters<ProgramService['addProgress']>[1]): Observable<ProgressUpdate> {
  return this.http.put<ProgressUpdate>(`${API_BASE}/api/goals/${goalId}/progress/${progressId}`, { ...payload, goalId });
  }

  deleteProgress(goalId: string, progressId: string): Observable<void> {
  return this.http.delete<void>(`${API_BASE}/api/goals/${goalId}/progress/${progressId}`);
  }

  getAdminSummary(): Observable<Record<string, number>> {
  return this.http.get<Record<string, number>>(`${API_BASE}/api/admin/dashboard`);
  }

  // Assignments
  getAssignments(studentId: string): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${API_BASE}/api/assignments/student/${studentId}`);
  }

  getAssignment(assignmentId: string): Observable<Assignment> {
    return this.http.get<Assignment>(`${API_BASE}/api/assignments/${assignmentId}`);
  }

  createAssignment(payload: { studentId: string; title: string; description?: string; dueDate?: string; assignedTo?: string; }): Observable<Assignment> {
    return this.http.post<Assignment>(`${API_BASE}/api/assignments`, payload);
  }

  updateAssignment(id: string, payload: { title: string; description?: string; dueDate?: string; status: string; assignedTo?: string; }): Observable<Assignment> {
    return this.http.put<Assignment>(`${API_BASE}/api/assignments/${id}`, payload);
  }

  deleteAssignment(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/api/assignments/${id}`);
  }
}
