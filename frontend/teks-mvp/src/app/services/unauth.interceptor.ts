import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export const unauthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(tap({
    next: () => { },
    error: (err: any) => {
      if (err && err.status === 401) {
        auth.logout();
        router.navigate(['/login']);
      }
    }
  }));
};
