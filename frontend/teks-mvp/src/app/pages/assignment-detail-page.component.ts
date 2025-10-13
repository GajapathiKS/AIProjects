import { Component, inject } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { ProgramService } from '../services/program.service';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-assignment-detail-page',
  imports: [NgIf, AsyncPipe],
  template: `
    <div class="card" *ngIf="assignment$ | async as a; else loading">
      <h2>{{ a.title }}</h2>
      <p>{{ a.description }}</p>
      <p>Assigned to: {{ a.assignedTo || '—' }} · Status: {{ a.status }}</p>
      <p>Due: {{ a.dueDate ? (a.dueDate.slice(0,10)) : '' }}</p>
    </div>
    <ng-template #loading>
      <div class="card">
        <p *ngIf="!errorMsg">Loading assignment…</p>
        <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
      </div>
    </ng-template>
  `
})
export class AssignmentDetailPageComponent {
  private api = inject(ProgramService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  assignmentId = this.route.snapshot.paramMap.get('assignmentId') || this.route.snapshot.paramMap.get('id')!;
  errorMsg: string | null = null;
  assignment$ = this.api.getAssignment(this.assignmentId).pipe(
    catchError(() => {
      this.errorMsg = 'Failed to load assignment.';
      return of(null as any);
    })
  );
}
