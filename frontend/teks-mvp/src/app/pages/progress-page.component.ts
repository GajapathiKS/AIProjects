import { Component, inject } from '@angular/core';
import { NgFor, NgIf, AsyncPipe, DatePipe } from '@angular/common';
import { ProgramService } from '../services/program.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, combineLatest, map, switchMap, of, catchError } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-progress-page',
  imports: [NgFor, NgIf, AsyncPipe, DatePipe],
  template: `
    <div class="card">
      <h2>Progress Updates</h2>
      <div style="display:flex; justify-content: flex-end; align-items:center; gap:.5rem; margin:.25rem 0 .5rem;">
  <button class="btn primary" type="button" (click)="addProgress()">+ New Progress</button>
      </div>
      <p class="error" *ngIf="errorMsg">{{ errorMsg }}</p>
        <table class="table" *ngIf="(updates$ | async) as list; else loading">
          <thead>
            <tr><th>Recorded</th><th>Summary</th><th>Recorded By</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of list">
              <td>{{ u.recordedAt | date:'M/d/yyyy, h:mm a' }}</td>
              <td>{{ u.summary }}</td>
              <td>{{ u.recordedBy }}</td>
            </tr>
            <tr *ngIf="!list.length">
              <td colspan="3">No progress updates found.</td>
            </tr>
          </tbody>
        </table>
      <ng-template #loading><p>Loading progress…</p></ng-template>
    </div>
  `
})
export class ProgressPageComponent {
  private api = inject(ProgramService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  studentId = (this.route.parent?.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id')) || undefined;
  errorMsg: string | null = null;
  updates$: Observable<{ recordedAt: string; summary: string; recordedBy: string; }[]> =
    (this.studentId ? this.api.getGoals(this.studentId) : of([])).pipe(
      switchMap((goals) => {
        if (!goals || goals.length === 0) {
          return new Observable<never[]>((sub) => { sub.next([] as never[]); sub.complete(); });
        }
        return combineLatest(goals.map(g => this.api.getProgress(g.id))).pipe(
          map((arr) => arr.flat())
        );
      }),
      map((list: any[]) => list
        .sort((a: any, b: any) => a.recordedAt < b.recordedAt ? 1 : -1)
        .map((u: any) => ({ recordedAt: u.recordedAt, summary: u.summary, recordedBy: u.recordedBy }))
      ),
      catchError(() => {
        this.errorMsg = 'Failed to load progress.';
        return of([]);
      })
    );

  addProgress() {
    if (!this.studentId) return;
    // Progress is attached to a goal; send the user to goals page to add progress under a specific goal
    this.router.navigate(['/students', this.studentId, 'goals']);
  }
}
