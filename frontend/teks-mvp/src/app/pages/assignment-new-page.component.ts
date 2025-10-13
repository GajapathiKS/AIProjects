import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProgramService } from '../services/program.service';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIf } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-assignment-new-page',
  imports: [ReactiveFormsModule, NgIf],
  template: `
    <div class="card">
      <h2>New Assignment</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <label>Title<input formControlName="title" required /></label>
        <label class="span-2">Description<textarea formControlName="description"></textarea></label>
        <label>Due Date<input type="date" formControlName="dueDate" /></label>
        <label>Assigned To<input formControlName="assignedTo" /></label>
        <div style="display:flex; gap:.5rem;">
          <button class="btn primary" type="submit" [disabled]="form.invalid">Create</button>
          <button class="btn" type="button" (click)="cancel()">Cancel</button>
        </div>
      </form>
      <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
    </div>
  `
})
export class AssignmentNewPageComponent {
  private fb = inject(FormBuilder);
  private api = inject(ProgramService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  // Prefer reading from parent route to avoid missing id when nested
  studentId: string | null = this.route.parent?.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
  errorMsg: string | null = null;

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    dueDate: [''],
    assignedTo: ['']
  });

  submit() {
    if (this.form.invalid) return;
    if (!this.studentId) {
      this.errorMsg = 'Missing student id in route.';
      return;
    }
    const raw = this.form.getRawValue();
    const payload: any = {
      studentId: this.studentId,
      title: raw.title,
      description: raw.description || '',
      // Normalize empty date to undefined so backend binder doesn't try to parse empty string
      dueDate: raw.dueDate ? raw.dueDate : undefined,
      assignedTo: raw.assignedTo || undefined
    };
    this.api.createAssignment(payload).subscribe({
      next: () => this.router.navigate(['/students', this.studentId!, 'assignments']),
      error: (err) => {
        const detail = err?.error?.title || err?.message || '';
        this.errorMsg = 'Failed to create assignment.' + (detail ? ' ' + detail : '');
      }
    });
  }

  cancel() {
    if (this.studentId) {
      this.router.navigate(['/students', this.studentId, 'assignments']);
    } else {
      this.router.navigate(['/assignments']);
    }
  }
}
