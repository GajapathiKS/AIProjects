import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { ProgramService } from '../services/program.service';
import { Goal, ProgressUpdate, StudentDetail } from '../models/student';
import { Observable } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-student-detail-page',
  imports: [NgIf, AsyncPipe, DatePipe],
  template: `
    <ng-container *ngIf="student$ | async as student">
      <div class="card student-overview">
        <h2>{{ student.firstName }} {{ student.lastName }}</h2>
        <div class="overview-grid">
          <div><span>Local ID</span><strong>{{ student.localId }}</strong></div>
          <div><span>Grade</span><strong>{{ student.gradeLevel }}</strong></div>
          <div><span>Campus</span><strong>{{ student.campus }}</strong></div>
          <div><span>Program Focus</span><strong>{{ student.programFocus || '—' }}</strong></div>
          <div><span>Guardian Contact</span><strong>{{ student.guardianContact }}</strong></div>
          <div><span>Enrollment</span><strong>{{ student.enrollmentDate | date:'M/d/yyyy' }}</strong></div>
          <div><span>Next Review</span><strong>{{ student.nextReviewDate | date:'M/d/yyyy' || 'TBD' }}</strong></div>
        </div>
      </div>
      <div class="card stats" aria-label="Student data summary">
        <div class="stat"><span>Needs Assessments</span><strong>{{ student.needsAssessments?.length || 0 }}</strong></div>
        <div class="stat"><span>Goals</span><strong>{{ student.goals?.length || 0 }}</strong></div>
        <div class="stat"><span>Latest Progress</span><strong>{{ latestProgress(student) || '—' }}</strong></div>
      </div>
    </ng-container>
  `,
  styles: [`
    textarea {
      min-height: 80px;
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #b5c7e7;
      border-radius: 4px;
      font-family: inherit;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      background: #f7f9ff;
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 0.75rem;
    }
    .goal {
      margin-bottom: 1.5rem;
    }
    .grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .status {
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
    }
    .status button {
      align-self: center;
    }
    .tag {
      display: inline-block;
      margin-top: 0.25rem;
      background: #e4edff;
      padding: 0.25rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      color: #274684;
    }
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .overview-grid span {
      display: block;
      font-size: 0.75rem;
      color: #5c6f92;
    }
    .overview-grid strong {
      font-size: 1rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .stat span { display:block; font-size: .75rem; color:#5c6f92; }
    .stat strong { font-size:1.25rem; }
  `]
})
export class StudentDetailPageComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ProgramService);

  studentId = this.route.snapshot.paramMap.get('id')!;
  student$: Observable<StudentDetail> = this.api.getStudent(this.studentId);

  latestProgress(student: StudentDetail): string | null {
    const all = (student.goals || []).flatMap(g => g.progressUpdates || []);
    if (!all.length) return null;
    const latest = all.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
    return latest?.recordedAt ?? null;
  }
}
