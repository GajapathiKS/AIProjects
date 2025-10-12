import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ProgramService } from '../services/program.service';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [NgIf, NgFor, AsyncPipe],
  template: `
    <div class="card" *ngIf="summary | async as totals; else loading">
      <h2>Program Snapshot</h2>
      <div class="grid">
        <div *ngFor="let item of entries(totals)">
          <h3>{{ item.key }}</h3>
          <p>{{ item.value }}</p>
        </div>
      </div>
    </div>
    <ng-template #loading>
      <p>Loading dashboard…</p>
    </ng-template>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
    }
    .grid div {
      background: #eef3ff;
      padding: 1rem;
      border-radius: 6px;
    }
  `]
})
export class DashboardPageComponent implements OnInit {
  private api = inject(ProgramService);
  summary = this.api.getAdminSummary();

  ngOnInit(): void {}

  entries(record: Record<string, number>) {
    return Object.entries(record).map(([key, value]) => ({ key, value }));
  }
}
