import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { StudentListPageComponent } from './pages/student-list-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { StudentDetailPageComponent } from './pages/student-detail-page.component';
import { AssignmentsListPageComponent } from './pages/assignments-list-page.component';
import { AssignmentDetailPageComponent } from './pages/assignment-detail-page.component';
import { AssignmentNewPageComponent } from './pages/assignment-new-page.component';
import { GoalsPageComponent } from './pages/goals-page.component';
import { GoalDetailPageComponent } from './pages/goal-detail-page.component';
import { ProgressPageComponent } from './pages/progress-page.component';
import { StudentShellComponent } from './pages/student-shell.component';
import { NeedsPageComponent } from './pages/needs-page.component';
import { GoalNewPageComponent } from './pages/goal-new-page.component';
import { NeedsNewPageComponent } from './pages/needs-new-page.component';
import { authGuard } from './services/auth.guard';

export const appRoutes: Routes = [
  { path: '', component: DashboardPageComponent, canActivate: [authGuard] },
  { path: 'students', component: StudentListPageComponent, canActivate: [authGuard] },
  {
    path: 'students/:id',
    component: StudentShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: StudentDetailPageComponent },
      { path: 'assignments', component: AssignmentsListPageComponent },
      { path: 'assignments/new', component: AssignmentNewPageComponent },
      { path: 'assignments/:assignmentId', component: AssignmentDetailPageComponent },
      { path: 'needs', component: NeedsPageComponent },
      { path: 'needs/new', component: NeedsNewPageComponent },
      { path: 'goals', component: GoalsPageComponent },
      { path: 'goals/new', component: GoalNewPageComponent },
      { path: 'goals/:goalId', component: GoalDetailPageComponent },
      { path: 'progress', component: ProgressPageComponent },
    ]
  },
  { path: 'login', component: LoginPageComponent },
  { path: '**', redirectTo: '' }
];
