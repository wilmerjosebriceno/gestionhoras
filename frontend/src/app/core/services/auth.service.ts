import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, timeout, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, CambioPassword } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<AuthResponse['usuario'] | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): AuthResponse['usuario'] | null {
    return this.currentUserSubject.getValue();
  }

  private permisosCache: Array<{ sistema?: string; pagina: string; acceso: boolean }> | null = null;

  get permisosCacheados(): Array<{ sistema?: string; pagina: string; acceso: boolean }> | null {
    return this.permisosCache;
  }

  constructor(private http: HttpClient) {
    const stored = localStorage.getItem('currentUser');
    if (stored) this.currentUserSubject.next(JSON.parse(stored));
  }

  login(dto: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/login`, dto).pipe(
      timeout(15000),
      catchError((err) => {
        if (err.name === 'TimeoutError') {
          return throwError(() => ({ error: { message: 'La solicitud tardó demasiado. Verifique su conexión.' } }));
        }
        return throwError(() => err);
      }),
      tap((res) => {
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);
        localStorage.setItem('currentUser', JSON.stringify(res.usuario));
        this.currentUserSubject.next(res.usuario);
      }),
    );
  }

  refresh(): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${this.api}/refresh`,
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem('refreshToken')}` } },
    );
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/logout`, {});
  }

  misPermisos(): Observable<{ admin: boolean; permisos: Array<{ sistema?: string; pagina: string; acceso: boolean }> }> {
    return this.http.post<{ admin: boolean; permisos: Array<{ sistema?: string; pagina: string; acceso: boolean }> }>(
      `${this.api}/mis-permisos`,
      {},
    ).pipe(
      tap((res) => {
        this.permisosCache = res.admin ? [] : res.permisos;
      }),
    );
  }

  cambiarPassword(dto: CambioPassword): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/cambiar-password`, dto);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    this.permisosCache = null;
    this.currentUserSubject.next(null);
  }
}
