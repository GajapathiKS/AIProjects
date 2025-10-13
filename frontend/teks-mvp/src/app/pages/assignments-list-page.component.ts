import { Component, inject } from '@angular/core';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';
import { ProgramService } from '../services/program.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap, catchError, of } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-assignments-list-page',
  imports: [NgFor, NgIf, AsyncPipe, RouterLink],
  template: `
    <div class="card">
      <h2>Assignments</h2>
      <div style="display:flex; justify-content: flex-end; align-items:center; margin:.25rem 0 .5rem;">
        <a class="btn primary" *ngIf="studentId" [routerLink]="['new']">+ New Assignment</a>
      </div>
      <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
      <table class="table" *ngIf="(assignments$ | async) as list; else loading">
        <thead>
          <tr><th>Title</th><th>Status</th><th>Due</th><th>Assigned To</th><th></th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of list">
            <td>{{ a.title }}</td>
            <td>{{ a.status }}</td>
            <td>{{ a.dueDate ? (a.dueDate.slice(0,10)) : '' }}</td>
            <td>{{ a.assignedTo || '—' }}</td>
    <td><a class="btn" [routerLink]="[a.id]">Open</a></td>
          </tr>
          <tr *ngIf="!list.length"><td colspan="5">No assignments yet.</td></tr>
        </tbody>
      </table>
      <ng-template #loading><p>Loading assignments…</p></ng-template>
    </div>
  `
})
export class AssignmentsListPageComponent {
  private api = inject(ProgramService);
  private route = inject(ActivatedRoute);

  studentId?: string | null = this.route.parent?.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
  errorMsg: string | null = null;

  assignments$ = (this.route.parent ?? this.route).paramMap.pipe(
    map(pm => pm.get('id')),
    switchMap(id => {
      this.studentId = id;
      if (!id) {
        this.errorMsg = 'Missing student id in route.';
        return of([]);
      }
      this.errorMsg = null;
      return this.api.getAssignments(id).pipe(
        catchError((err) => {
          const code = err?.status ? ` (status ${err.status})` : '';
          this.errorMsg = `Failed to load assignments${code}.`;
          return of([]);
        })
      );
    })
  );

}
