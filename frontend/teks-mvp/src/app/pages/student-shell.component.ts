import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { ProgramService } from '../services/program.service';
import { AsyncPipe } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-student-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf, AsyncPipe],
  template: `
    <div class="topbar" *ngIf="student$ | async as s">
      <nav class="breadcrumb">
        <a routerLink="/students">Students</a>
        <span>/</span>
        <span>{{ s.firstName }} {{ s.lastName }}</span>
      </nav>
      <div class="title">{{ s.firstName }} {{ s.lastName }}</div>
    </div>
    <div class="layout" *ngIf="studentId as id">
      <aside class="sidebar">
        <a [routerLink]="['/students', id]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Info</a>
        <a [routerLink]="['/students', id, 'assignments']" routerLinkActive="active">Assignments</a>
        <a [routerLink]="['/students', id, 'needs']" routerLinkActive="active">Needs</a>
        <a [routerLink]="['/students', id, 'goals']" routerLinkActive="active">Goals</a>
        <a [routerLink]="['/students', id, 'progress']" routerLinkActive="active">Progress</a>
      </aside>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 220px 1fr; gap: 1rem; }
    .sidebar { background: #f7f9ff; border: 1px solid #b5c7e7; border-radius: 8px; padding: .75rem; display: flex; flex-direction: column; gap: .5rem; }
    .sidebar a { text-decoration: none; color: #274684; padding: .5rem .625rem; border-radius: 6px; }
    .sidebar a.active, .sidebar a:hover { background: #eaf1ff; }
    .topbar { display:flex; align-items:center; justify-content: space-between; margin-bottom: .75rem; }
    .breadcrumb { display:flex; align-items:center; gap:.5rem; color:#5c6f92; }
    .breadcrumb a { color:#274684; text-decoration:none; }
    .title { font-size: 1.25rem; font-weight: 600; color:#122b57; }
  `]
})
export class StudentShellComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ProgramService);
  studentId = this.route.snapshot.paramMap.get('id')!;
  student$ = this.api.getStudent(this.studentId);
}
