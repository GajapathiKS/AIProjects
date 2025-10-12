import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProgramService } from '../services/program.service';
import { Goal, ProgressUpdate, StudentDetail } from '../models/student';
import { Observable } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-student-detail-page',
  imports: [NgIf, NgFor, AsyncPipe, ReactiveFormsModule, DatePipe],
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
          <div><span>Enrollment</span><strong>{{ student.enrollmentDate | date }}</strong></div>
          <div><span>Next Review</span><strong>{{ student.nextReviewDate | date:'shortDate' || 'TBD' }}</strong></div>
        </div>
      </div>
    </ng-container>

    <div class="card" *ngIf="studentId as id">
      <h2>Needs Assessment</h2>
      <form [formGroup]="needsForm" (ngSubmit)="addNeeds(id)">
        <label>Academic Needs <textarea formControlName="academicNeeds"></textarea></label>
        <label>Support Services <textarea formControlName="supportServices"></textarea></label>
        <label>Instructional Strategies <textarea formControlName="instructionalStrategies"></textarea></label>
        <label>Assessment Tools <textarea formControlName="assessmentTools"></textarea></label>
        <button type="submit" [disabled]="needsForm.invalid">Save Assessment</button>
      </form>
      <ul>
        <li *ngFor="let item of needs$ | async">
          <header>
            <strong>{{ item.createdAt | date:'short' }}</strong>
            <span>{{ item.assessmentTools }}</span>
          </header>
          <p>{{ item.academicNeeds }}</p>
          <small>{{ item.supportServices }}</small>
          <small class="tag">Strategies: {{ item.instructionalStrategies }}</small>
        </li>
      </ul>
    </div>

    <div class="card" *ngIf="studentId as id">
      <h2>Goal Setting & Progress</h2>
      <form [formGroup]="goalForm" (ngSubmit)="addGoal(id)">
        <div class="grid">
          <label>Description<textarea formControlName="description"></textarea></label>
          <label>Category<input formControlName="category" /></label>
          <label>Measurement<input formControlName="measurement" /></label>
          <label>Owner<input formControlName="owner" /></label>
          <label>Target Date<input type="date" formControlName="targetDate" /></label>
        </div>
        <button type="submit" [disabled]="goalForm.invalid">Save Goal</button>
      </form>
      <div *ngFor="let goal of goals$ | async" class="goal">
        <header>
          <div>
            <h3>{{ goal.description }}</h3>
            <p>Category: {{ goal.category }} · Measurement: {{ goal.measurement }}</p>
            <p>Owner: {{ goal.owner }} · Target {{ goal.targetDate | date }}</p>
          </div>
          <div class="status">
            <label>
              Status
              <select [value]="goal.status" (change)="updateStatus(goal, $event.target.value)">
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Blocked">Blocked</option>
                <option value="Completed">Completed</option>
              </select>
            </label>
            <button type="button" (click)="removeGoal(goal)">Delete</button>
          </div>
        </header>
        <form [formGroup]="progressForms[goal.id]" (ngSubmit)="addProgress(goal.id)">
          <label>Progress Summary<textarea formControlName="summary"></textarea></label>
          <label>Outcome<textarea formControlName="outcome"></textarea></label>
          <div class="grid">
            <label>Evidence URL<input formControlName="evidenceUrl" placeholder="https://..." /></label>
            <label>Next Action<input formControlName="nextAction" /></label>
            <label>Recorded By<input formControlName="recordedBy" /></label>
          </div>
          <button type="submit" [disabled]="progressForms[goal.id].invalid">Add Progress</button>
        </form>
        <ul>
          <li *ngFor="let update of progressMap[goal.id] | async">
            <header>
              <strong>{{ update.recordedAt | date:'short' }}</strong>
              <span>{{ update.recordedBy }}</span>
            </header>
            <p>{{ update.summary }}</p>
            <small>{{ update.outcome }}</small>
            <div class="evidence" *ngIf="update.evidenceUrl">Evidence: <a [href]="update.evidenceUrl" target="_blank">{{ update.evidenceUrl }}</a></div>
            <small class="tag" *ngIf="update.nextAction">Next: {{ update.nextAction }}</small>
          </li>
        </ul>
      </div>
    </div>
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
  `]
})
export class StudentDetailPageComponent {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private api = inject(ProgramService);

  studentId = this.route.snapshot.paramMap.get('id')!;
  student$: Observable<StudentDetail> = this.api.getStudent(this.studentId);
  needs$ = this.api.getNeeds(this.studentId);
  goals$: Observable<Goal[]> = this.fetchGoals();
  progressMap: Record<string, Observable<ProgressUpdate[]>> = {};
  progressForms: Record<string, ReturnType<FormBuilder['group']>> = {};

  needsForm = this.fb.nonNullable.group({
    academicNeeds: ['', Validators.required],
    supportServices: ['', Validators.required],
    instructionalStrategies: ['', Validators.required],
    assessmentTools: ['', Validators.required]
  });

  goalForm = this.fb.nonNullable.group({
    description: ['', Validators.required],
    category: ['Academic', Validators.required],
    measurement: ['', Validators.required],
    owner: ['', Validators.required],
    targetDate: ['', Validators.required]
  });

  private fetchGoals(): Observable<Goal[]> {
    const obs = this.api.getGoals(this.studentId);
    obs.subscribe(goals => {
      goals.forEach(goal => {
        if (!this.progressMap[goal.id]) {
          this.progressMap[goal.id] = this.api.getProgress(goal.id);
        }
        if (!this.progressForms[goal.id]) {
          this.progressForms[goal.id] = this.fb.nonNullable.group({
            summary: ['', Validators.required],
            outcome: ['', Validators.required],
            evidenceUrl: [''],
            nextAction: [''],
            recordedBy: ['', Validators.required]
          });
        }
      });
    });
    return obs;
  }

  refresh() {
    this.student$ = this.api.getStudent(this.studentId);
    this.needs$ = this.api.getNeeds(this.studentId);
    this.goals$ = this.fetchGoals();
  }

  addNeeds(studentId: string) {
    if (this.needsForm.invalid) return;
    this.api.createNeeds({ studentId, ...this.needsForm.getRawValue() })
      .subscribe(() => {
        this.needsForm.reset({ academicNeeds: '', supportServices: '', instructionalStrategies: '', assessmentTools: '' });
        this.refresh();
      });
  }

  addGoal(studentId: string) {
    if (this.goalForm.invalid) return;
    this.api.createGoal({ studentId, ...this.goalForm.getRawValue() })
      .subscribe(() => {
        this.goalForm.reset({ description: '', category: 'Academic', measurement: '', owner: '', targetDate: '' });
        this.refresh();
      });
  }

  updateStatus(goal: Goal, status: string) {
    this.api.updateGoalStatus(goal.id, status).subscribe(() => this.refresh());
  }

  removeGoal(goal: Goal) {
    this.api.deleteGoal(goal.id).subscribe(() => this.refresh());
  }

  addProgress(goalId: string) {
    const form = this.progressForms[goalId];
    if (!form || form.invalid) return;
    const payload = { ...form.getRawValue() };
    this.api.addProgress(goalId, payload)
      .subscribe(() => {
        form.reset({ summary: '', outcome: '', evidenceUrl: '', nextAction: '', recordedBy: '' });
        this.progressMap[goalId] = this.api.getProgress(goalId);
        this.refresh();
      });
  }
}
