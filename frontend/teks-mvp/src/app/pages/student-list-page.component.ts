import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProgramService } from '../services/program.service';
import { StudentSummary } from '../models/student';

@Component({
  standalone: true,
  selector: 'app-student-list-page',
  imports: [NgFor, NgIf, AsyncPipe, RouterLink, ReactiveFormsModule, DatePipe],
  template: `
    <div class="card">
      <div style="display:flex; align-items:center; justify-content: space-between;">
        <h2 data-testid="students-heading">Students</h2>
        <button data-testid="add-student" class="btn primary" type="submit" form="onboardForm" [disabled]="form.invalid || form.pending">Add Student</button>
      </div>
      <form id="onboardForm" [formGroup]="form" (ngSubmit)="submit()" class="form-grid" style="margin-top:.75rem;">
        <div class="form-grid">
          <label>
            Local ID
            <input formControlName="localId" />
          </label>
          <label>
            First Name
            <input formControlName="firstName" />
          </label>
          <label>
            Last Name
            <input formControlName="lastName" />
          </label>
          <label>
            Date of Birth
            <input type="date" formControlName="dateOfBirth" />
          </label>
          <label>
            Grade Level
            <input formControlName="gradeLevel" />
          </label>
          <label>
            Campus
            <input formControlName="campus" />
          </label>
          <label>
            Program Focus
            <input formControlName="programFocus" placeholder="Bilingual Support" />
          </label>
          <label>
            Guardian Contact
            <input formControlName="guardianContact" placeholder="parent@domain" />
          </label>
          <label>
            Enrollment Date
            <input type="date" formControlName="enrollmentDate" />
          </label>
          <label>
            Next Review Date
            <input type="date" formControlName="nextReviewDate" />
          </label>
        </div>
      </form>
    </div>

    <div class="card">
      <h3>Active Students</h3>
      <div *ngIf="students | async as items; else loading">
        <p *ngIf="!items.length">No students enrolled yet.</p>
        <table class="table" *ngIf="items.length">
          <thead>
            <tr>
              <th>Local ID</th>
              <th>Name</th>
              <th>Grade</th>
              <th>Campus</th>
              <th>Program</th>
              <th>Active Goals</th>
              <th>Next Review</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let student of items">
              <td>{{ student.localId }}</td>
              <td>{{ student.firstName }} {{ student.lastName }}</td>
              <td>{{ student.gradeLevel }}</td>
              <td>{{ student.campus }}</td>
              <td>{{ student.programFocus }}</td>
              <td>{{ student.activeGoals }}</td>
              <td>{{ student.nextReviewDate | date:'M/d/yyyy' || 'TBD' }}</td>
              <td><a class="btn" [routerLink]="['/students', student.id]">Open</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <ng-template #loading>
        <p>Loading students…</p>
      </ng-template>
    </div>
  `,
  styles: []
})
export class StudentListPageComponent {
  private fb = inject(FormBuilder);
  private api = inject(ProgramService);

  students = this.api.getStudents();

  form = this.fb.nonNullable.group({
    localId: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    dateOfBirth: ['', Validators.required],
    gradeLevel: ['', Validators.required],
    campus: ['', Validators.required],
    guardianContact: ['', Validators.required],
    programFocus: [''],
    enrollmentDate: [new Date().toISOString().slice(0, 10), Validators.required],
    nextReviewDate: ['']
  });

  submit() {
    if (this.form.invalid) {
      return;
    }
    const payload = {
      ...this.form.getRawValue(),
      nextReviewDate: this.form.value.nextReviewDate || null
    };
    this.api.createStudent({
      ...payload,
      dateOfBirth: payload.dateOfBirth,
      enrollmentDate: payload.enrollmentDate
    }).subscribe(() => {
      this.form.reset({
        localId: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gradeLevel: '',
        campus: '',
        guardianContact: '',
        programFocus: '',
        enrollmentDate: new Date().toISOString().slice(0, 10),
        nextReviewDate: ''
      });
      this.students = this.api.getStudents();
    });
  }
}
