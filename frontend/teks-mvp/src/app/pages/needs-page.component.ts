import { Component, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { ProgramService } from '../services/program.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, switchMap, of, catchError } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-needs-page',
  imports: [NgFor, NgIf, AsyncPipe, ReactiveFormsModule, RouterLink],
  template: `
    <div class="card">
      <h2>Needs Assessments</h2>
      <div style="display:flex; justify-content:flex-end; margin:.25rem 0 .5rem;">
  <a class="btn primary" [routerLink]="['new']">+ New Needs Assessment</a>
      </div>
      <p *ngIf="added" class="success">Needs assessment added.</p>
      <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
      <table class="table" *ngIf="needs$ | async as list; else loading">
        <thead>
          <tr>
            <th>Created</th>
            <th>Academic Needs</th>
            <th>Support Services</th>
            <th>Instructional Strategies</th>
            <th>Assessment Tools</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let n of list">
            <td>{{ n.createdAt ? (n.createdAt.slice(0,10)) : '' }}</td>
            <td>{{ n.academicNeeds }}</td>
            <td>{{ n.supportServices }}</td>
            <td>{{ n.instructionalStrategies }}</td>
            <td>{{ n.assessmentTools }}</td>
          </tr>
          <tr *ngIf="!list.length"><td colspan="5">No needs assessments yet.</td></tr>
        </tbody>
      </table>
      <ng-template #loading><p>Loading needs…</p></ng-template>
    </div>
  `
})
export class NeedsPageComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ProgramService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  errorMsg: string | null = null;
  studentId?: string | null = this.route.parent?.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
  added = (this.route.parent ?? this.route).snapshot.queryParamMap.get('added') === '1';
  needs$ = (this.route.parent ?? this.route).paramMap.pipe(
    map(pm => pm.get('id')),
    switchMap(id => {
      this.studentId = id;
      if (!id) {
        this.errorMsg = 'Missing student id in route.';
        return of([]);
      }
      this.errorMsg = null;
      return this.api.getNeeds(id).pipe(
        catchError(() => {
          this.errorMsg = 'Failed to load needs assessments.';
          return of([]);
        })
      );
    })
  );
}
