import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { StudentListPageComponent } from './pages/student-list-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { StudentDetailPageComponent } from './pages/student-detail-page.component';

export const appRoutes: Routes = [
  { path: '', component: DashboardPageComponent },
  { path: 'students', component: StudentListPageComponent },
  { path: 'students/:id', component: StudentDetailPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: '**', redirectTo: '' }
];
