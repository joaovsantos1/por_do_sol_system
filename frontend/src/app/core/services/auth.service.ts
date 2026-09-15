import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginResponse {
  token: string;
  nome: string;
  perfil: string;
  expiraEm: string;
}

const TOKEN_KEY = 'pdv_token';
const USER_KEY = 'pdv_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signal reativo com o usuário atual, usado pela shell/guards sem precisar
  // re-ler o localStorage a cada verificação.
  usuario = signal<{ nome: string; perfil: string } | null>(this.carregarUsuario());

  constructor(private http: HttpClient) {}

  login(login: string, senha: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { login, senha }).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify({ nome: res.nome, perfil: res.perfil }));
        this.usuario.set({ nome: res.nome, perfil: res.perfil });
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.usuario.set(null);
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get estaAutenticado(): boolean {
    return !!this.token;
  }

  temPerfil(perfis: string[]): boolean {
    const u = this.usuario();
    return !!u && perfis.includes(u.perfil);
  }

  private carregarUsuario() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
