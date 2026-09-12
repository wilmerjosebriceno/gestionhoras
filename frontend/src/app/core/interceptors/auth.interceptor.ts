import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, TimeoutError } from 'rxjs';
import { catchError, switchMap, filter, take, timeout } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshing = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getAccessToken();
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }

    return next.handle(req).pipe(
      catchError((err) => {
        if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
          return this.handleRefresh(req, next);
        }
        return throwError(() => err);
      }),
    );
  }

  private handleRefresh(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.refreshing) {
      this.refreshing = true;
      this.refreshSubject.next(null);

      return this.authService.refresh().pipe(
        timeout(30000),
        switchMap((res) => {
          this.refreshing = false;
          localStorage.setItem('accessToken', res.accessToken);
          localStorage.setItem('refreshToken', res.refreshToken);
          this.refreshSubject.next(res.accessToken);
          return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }));
        }),
        catchError((err) => {
          this.refreshing = false;
          this.refreshSubject.next('__ERROR__');
          this.authService.clearSession();
          window.location.href = '/login';
          return throwError(() => err);
        }),
      );
    }

    return this.refreshSubject.pipe(
      filter((token) => token !== null),
      take(1),
      timeout(30000),
      catchError((err) => {
        this.refreshing = false;
        this.authService.clearSession();
        window.location.href = '/login';
        return throwError(() => (err instanceof TimeoutError ? new HttpErrorResponse({ status: 401, statusText: 'Sesión expirada' }) : err));
      }),
      switchMap((token) => {
        if (token === '__ERROR__') {
          this.authService.clearSession();
          window.location.href = '/login';
          return throwError(() => ({ status: 401, message: 'Sesión expirada' }));
        }
        return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
      }),
    );
  }
}
