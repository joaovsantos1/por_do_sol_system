import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ComandaItem {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface Comanda {
  id: string;
  numero: number;
  codigoIdentificador: string;
  status: string;
  abertaEm: string;
  abertaPor: string;
  valorTotal: number;
  observacoes?: string;
  itens: ComandaItem[];
}

export interface ComandaResumo {
  id: string;
  numero: number;
  codigoIdentificador: string;
  abertaEm: string;
  abertaPor: string;
  itens: number;
  valorTotal: number;
}

export interface PagamentoInput {
  forma: 'Pix' | 'Dinheiro' | 'Cartao';
  valor: number;
}

@Injectable({ providedIn: 'root' })
export class ComandasService {
  private readonly base = `${environment.apiUrl}/comandas`;

  constructor(private http: HttpClient) {}

  listarAbertas(): Observable<ComandaResumo[]> {
    return this.http.get<ComandaResumo[]>(`${this.base}/abertas`);
  }

  buscar(identificador: string): Observable<Comanda> {
    return this.http.get<Comanda>(`${this.base}/${identificador}`);
  }

  abrir(observacoes?: string): Observable<{ id: string; numero: number; codigoIdentificador: string }> {
    return this.http.post<{ id: string; numero: number; codigoIdentificador: string }>(`${this.base}/abrir`, { observacoes });
  }

  adicionarItem(comandaId: string, produtoId: string, quantidade: number): Observable<ComandaItem> {
    return this.http.post<ComandaItem>(`${this.base}/${comandaId}/itens`, { produtoId, quantidade });
  }

  alterarQuantidade(comandaId: string, itemId: string, novaQuantidade: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${comandaId}/itens/${itemId}`, { novaQuantidade });
  }

  removerItem(comandaId: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${comandaId}/itens/${itemId}`);
  }

  cancelar(comandaId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${comandaId}/cancelar`, {});
  }

  fechar(comandaId: string, pagamentos: PagamentoInput[]): Observable<{ id: string; total: number }> {
    return this.http.post<{ id: string; total: number }>(`${this.base}/${comandaId}/fechar`, { pagamentos });
  }
}
