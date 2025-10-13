import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProgramService } from '../services/program.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-needs-new-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <h2>New Needs Assessment</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <label class="span-2">Academic Needs<textarea formControlName="academicNeeds" required></textarea></label>
        <label class="span-2">Support Services<textarea formControlName="supportServices" required></textarea></label>
        <label class="span-2">Instructional Strategies<textarea formControlName="instructionalStrategies" required></textarea></label>
        <label class="span-2">Assessment Tools<textarea formControlName="assessmentTools" required></textarea></label>
        <div style="display:flex; gap:.5rem;">
          <button class="btn primary" type="submit" [disabled]="form.invalid">Create</button>
          <button class="btn" type="button" (click)="cancel()">Cancel</button>
        </div>
        <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
      </form>
    </div>
  `
})
export class NeedsNewPageComponent {
  private fb = inject(FormBuilder);
  private api = inject(ProgramService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  studentId = this.route.parent?.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id')!;
  errorMsg: string | null = null;

  form = this.fb.nonNullable.group({
    academicNeeds: ['', Validators.required],
    supportServices: ['', Validators.required],
    instructionalStrategies: ['', Validators.required],
    assessmentTools: ['', Validators.required]
  });

  submit() {
    if (this.form.invalid) return;
    const payload = { studentId: this.studentId, ...this.form.getRawValue() } as any;
    this.api.createNeeds(payload).subscribe({
      next: () => this.router.navigate(['/students', this.studentId, 'needs'], { queryParams: { added: '1' } }),
      error: () => this.errorMsg = 'Failed to create needs assessment.'
    });
  }

  cancel() { this.router.navigate(['/students', this.studentId, 'needs']); }
}
