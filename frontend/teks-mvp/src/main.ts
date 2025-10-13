import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { authInterceptor } from './app/services/auth.interceptor';
import { unauthInterceptor } from './app/services/unauth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
  provideHttpClient(withInterceptors([authInterceptor, unauthInterceptor]))
  ]
}).catch(err => console.error(err));
