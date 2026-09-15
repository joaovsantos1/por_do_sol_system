import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Usuario {
  id: string;
  nome: string;
  login: string;
  perfil: string;
  ativo: boolean;
  ultimoAcesso?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly base = `${environment.apiUrl}/users`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.base);
  }

  criar(usuario: { nome: string; login: string; senha: string; perfil: string }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.base, usuario);
  }

  editar(id: string, dados: { nome: string; perfil: string }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, dados);
  }

  trocarSenha(id: string, novaSenha: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/senha`, { novaSenha });
  }

  alternarAtivo(id: string, ativo: boolean): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/${ativo ? 'ativar' : 'inativar'}`, {});
  }
}
