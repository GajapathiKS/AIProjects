import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, NgIf],
  template: `
    <div class="card auth" data-testid="login-card">
      <h2>Staff Login</h2>

      <form [formGroup]="form" (ngSubmit)="submit()" data-testid="login-form" novalidate>
        <label for="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="Enter username"
          autocomplete="username"
          aria-label="Username"
          data-testid="username"
          formControlName="username"
          required
        />

        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Enter password"
          autocomplete="current-password"
          aria-label="Password"
          data-testid="password"
          formControlName="password"
          required
        />

        <!-- Only loading disables the button; validity is checked in submit() -->
        <button
          id="submit-login"
          data-testid="submit-login"
          type="submit"
          [disabled]="loading"
        >
          Sign In
        </button>
      </form>

      <p *ngIf="error" class="error" data-testid="login-error">{{ error }}</p>
    </div>
  `,
  styles: [`
    .auth { max-width: 320px; margin: 0 auto; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    label { font-weight: 600; }
    input { padding: 0.5rem; border: 1px solid #b5c7e7; border-radius: 4px; }
    .error { color: #b30000; }
  `]
})
export class LoginPageComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = false;
  error = '';

  form = this.fb.nonNullable.group({
    username: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    password: this.fb.nonNullable.control('', { validators: [Validators.required] })
  });

  submit() {
    if (this.form.invalid) return;            // still guard invalid submits
    this.loading = true;
    this.error = '';
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/');
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid credentials';
      }
    });
  }
}
