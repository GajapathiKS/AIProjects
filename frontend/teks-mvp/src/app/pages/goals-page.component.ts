import { Component, inject } from '@angular/core';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';
import { ProgramService } from '../services/program.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap, catchError, of } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-goals-page',
  imports: [NgFor, NgIf, AsyncPipe, RouterLink],
  template: `
    <div class="card">
      <h2>Goals</h2>
      <div style="display:flex; justify-content: flex-end; align-items:center; gap:.5rem; margin:.25rem 0 .5rem;">
        <a class="btn primary" [routerLink]="['new']">+ New Goal</a>
      </div>
      <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
      <table class="table" *ngIf="(goals$ | async) as list; else loading">
        <thead>
          <tr><th>Description</th><th>Category</th><th>Owner</th><th>Status</th><th>Target Date</th><th></th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let g of list">
            <td>{{ g.description }}</td>
            <td>{{ g.category }}</td>
            <td>{{ g.owner }}</td>
            <td>{{ g.status }}</td>
            <td>{{ g.targetDate ? (g.targetDate.slice(0,10)) : '' }}</td>
    <td><a class="btn" [routerLink]="[g.id]">Open</a></td>
          </tr>
          <tr *ngIf="!list.length"><td colspan="6">No goals yet.</td></tr>
        </tbody>
      </table>
      <ng-template #loading><p>Loading goals…</p></ng-template>
    </div>
  `
})
export class GoalsPageComponent {
  private api = inject(ProgramService);
  private route = inject(ActivatedRoute);

  studentId?: string | null = this.route.parent?.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
  errorMsg: string | null = null;

  goals$ = (this.route.parent ?? this.route).paramMap.pipe(
    map(pm => pm.get('id')),
    switchMap(id => {
      this.studentId = id;
      if (!id) {
        this.errorMsg = 'Missing student id in route.';
        return of([]);
      }
      this.errorMsg = null;
      return this.api.getGoals(id).pipe(
        catchError(() => {
          this.errorMsg = 'Failed to load goals.';
          return of([]);
        })
      );
    })
  );
}
