import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { AuthResponse, LoginRequest } from '../models/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private auth$ = new BehaviorSubject<AuthResponse | null>(this.restore());

  readonly user$ = this.auth$.asObservable();

  login(payload: LoginRequest) {
    return this.http
      .post<AuthResponse>(`/api/auth/login`, payload)
      .pipe(tap(res => {
        this.auth$.next(res);
        localStorage.setItem('teks-auth', JSON.stringify(res));
      }));
  }

  logout() {
    localStorage.removeItem('teks-auth');
    this.auth$.next(null);
  }

  get token(): string | null {
    return this.auth$.value?.token ?? null;
  }

  private restore(): AuthResponse | null {
    const cached = localStorage.getItem('teks-auth');
    return cached ? JSON.parse(cached) as AuthResponse : null;
  }
}
