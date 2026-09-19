import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface ComandaItem {
  id: string;
  produtoId?: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface Comanda {
  id: string;
  numero: number;
  codigoIdentificador: string;
  numeroMesa?: number;
  nomeCliente?: string;
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
  numeroMesa?: number;
  nomeCliente?: string;
  status?: string;
  abertaEm: string;
  abertaPor: string;
  fechadaEm?: string;
  fechadaPor?: string;
  itens: number;
  valorTotal: number;
}

/// Usado pela tela de histórico — igual ao ComandaResumo, mas com a lista
/// de itens completa (nome, quantidade, subtotal) em vez de só a contagem,
/// já que ali faz sentido mostrar o que foi vendido em cada comanda.
export interface ComandaHistorico extends Omit<ComandaResumo, "itens"> {
  itens: ComandaItem[];
}

export interface PagamentoInput {
  forma: "Pix" | "Dinheiro" | "Cartao";
  valor: number;
}

@Injectable({ providedIn: "root" })
export class ComandasService {
  private readonly base = `${environment.apiUrl}/comandas`;

  constructor(private http: HttpClient) {}

  listarAbertas(): Observable<ComandaResumo[]> {
    return this.http.get<ComandaResumo[]>(`${this.base}/abertas`);
  }

  /// Histórico de comandas com filtro opcional por status (Aberta/Fechada/
  /// Cancelada) e período pela data de abertura (yyyy-MM-dd) — já retorna
  /// os itens de cada comanda.
  historico(
    status?: string,
    inicio?: string,
    fim?: string,
  ): Observable<ComandaHistorico[]> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);
    const query = params.toString();
    return this.http.get<ComandaHistorico[]>(
      `${this.base}${query ? "?" + query : ""}`,
    );
  }

  buscar(identificador: string): Observable<Comanda> {
    return this.http.get<Comanda>(`${this.base}/${identificador}`);
  }

  abrir(dados?: {
    observacoes?: string;
    numeroMesa?: number;
    nomeCliente?: string;
  }): Observable<{ id: string; numero: number; codigoIdentificador: string }> {
    return this.http.post<{
      id: string;
      numero: number;
      codigoIdentificador: string;
    }>(`${this.base}/abrir`, dados ?? {});
  }

  adicionarItem(
    comandaId: string,
    produtoId: string,
    quantidade: number,
  ): Observable<ComandaItem> {
    return this.http.post<ComandaItem>(`${this.base}/${comandaId}/itens`, {
      produtoId,
      quantidade,
    });
  }

  alterarQuantidade(
    comandaId: string,
    itemId: string,
    novaQuantidade: number,
  ): Observable<void> {
    return this.http.put<void>(`${this.base}/${comandaId}/itens/${itemId}`, {
      novaQuantidade,
    });
  }

  removerItem(comandaId: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${comandaId}/itens/${itemId}`);
  }

  cancelar(comandaId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${comandaId}/cancelar`, {});
  }

  /// Estorna uma comanda já FECHADA — cancela a venda gerada, devolve os
  /// produtos ao estoque e registra o motivo (nunca apaga nada).
  estornar(comandaId: string, motivo: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${comandaId}/estornar`, {
      motivo,
    });
  }

  fechar(
    comandaId: string,
    pagamentos: PagamentoInput[],
  ): Observable<{ id: string; total: number }> {
    return this.http.post<{ id: string; total: number }>(
      `${this.base}/${comandaId}/fechar`,
      { pagamentos },
    );
  }
}
