import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProgramService } from '../services/program.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-goal-new-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <h2>New Goal</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <label>Description<textarea formControlName="description" required></textarea></label>
        <label>Category<input formControlName="category" required /></label>
        <label>Measurement<input formControlName="measurement" required /></label>
        <label>Owner<input formControlName="owner" required /></label>
        <label>Target Date<input type="date" formControlName="targetDate" required /></label>
        <div style="display:flex; gap:.5rem;">
          <button class="btn primary" type="submit" [disabled]="form.invalid">Create</button>
          <button class="btn" type="button" (click)="cancel()">Cancel</button>
        </div>
        <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
      </form>
    </div>
  `
})
export class GoalNewPageComponent {
  private fb = inject(FormBuilder);
  private api = inject(ProgramService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  studentId = this.route.parent?.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id')!;
  errorMsg: string | null = null;

  form = this.fb.nonNullable.group({
    description: ['', Validators.required],
    category: ['Academic', Validators.required],
    measurement: ['', Validators.required],
    owner: ['', Validators.required],
    targetDate: ['', Validators.required]
  });

  submit() {
    if (this.form.invalid) return;
    const payload = { studentId: this.studentId, ...this.form.getRawValue() } as any;
    this.api.createGoal(payload).subscribe({
      next: () => this.router.navigate(['/students', this.studentId, 'goals']),
      error: () => this.errorMsg = 'Failed to create goal.'
    });
  }

  cancel() { this.router.navigate(['/students', this.studentId, 'goals']); }
}
