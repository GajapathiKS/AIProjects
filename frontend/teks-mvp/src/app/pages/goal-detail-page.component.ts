import { Component, inject } from '@angular/core';
import { NgIf, AsyncPipe, NgFor } from '@angular/common';
import { ProgramService } from '../services/program.service';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-goal-detail-page',
  imports: [NgIf, AsyncPipe, NgFor, ReactiveFormsModule],
  template: `
    <div class="card" *ngIf="goal$ | async as g; else loading">
      <h2>{{ g.description }}</h2>
      <p>Owner: {{ g.owner }} · Status: {{ g.status }}</p>
      <h3>Progress</h3>
      <ul>
        <li *ngFor="let p of progress$ | async">
          <strong>{{ p.recordedAt | date:'M/d/yyyy, h:mm a' }}</strong>
          <p>{{ p.summary }}</p>
        </li>
      </ul>
      <div class="card">
        <h3>Add Progress</h3>
        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <label class="span-2">Summary<textarea formControlName="summary" required></textarea></label>
          <label>Outcome<input formControlName="outcome" required></label>
          <label>Evidence URL<input formControlName="evidenceUrl"></label>
          <label class="span-2">Next Action<textarea formControlName="nextAction"></textarea></label>
          <label>Recorded By<input formControlName="recordedBy" required></label>
          <div style="display:flex; gap:.5rem;">
            <button class="btn primary" type="submit" [disabled]="form.invalid">Add</button>
            <button class="btn" type="button" (click)="form.reset()">Clear</button>
          </div>
          <p class="error" *ngIf="errorMsg2">{{ errorMsg2 }}</p>
        </form>
      </div>
    </div>
    <ng-template #loading>
      <div class="card">
        <p *ngIf="!errorMsg">Loading goal…</p>
        <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
      </div>
    </ng-template>
  `
})
export class GoalDetailPageComponent {
  private api = inject(ProgramService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  errorMsg: string | null = null;
  errorMsg2: string | null = null;
  goalId = this.route.snapshot.paramMap.get('goalId') || this.route.snapshot.paramMap.get('id')!;
  goal$ = this.api.getGoal(this.goalId).pipe(
    catchError(() => { this.errorMsg = 'Failed to load goal.'; return of(null as any); })
  );
  progress$ = this.api.getProgress(this.goalId);

  form = this.fb.nonNullable.group({
    summary: ['', Validators.required],
    outcome: ['', Validators.required],
    evidenceUrl: [''],
    nextAction: [''],
    recordedBy: ['', Validators.required]
  });

  submit() {
    if (this.form.invalid) return;
    this.api.addProgress(this.goalId, this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset({ summary: '', outcome: '', evidenceUrl: '', nextAction: '', recordedBy: '' });
        this.progress$ = this.api.getProgress(this.goalId);
        this.errorMsg2 = null;
      },
      error: () => this.errorMsg2 = 'Failed to add progress.'
    });
  }
}
