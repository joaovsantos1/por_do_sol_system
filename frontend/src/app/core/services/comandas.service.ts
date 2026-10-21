import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { DadosComprovante } from "./impressao.service";

export interface ComandaItem {
  id: string;
  produtoId?: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  grupoComboId?: string;
  comboNomeSnapshot?: string;
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
  forma: "Pix" | "Dinheiro" | "CartaoCredito" | "CartaoDebito";
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

  /// Adiciona um combo/kit (ex.: "Salgado + Refri") — o backend debita o
  /// estoque de cada produto componente e cria as linhas com preço já
  /// recalculado proporcionalmente ao preço promocional do combo.
  adicionarCombo(
    comandaId: string,
    comboId: string,
    quantidade: number,
  ): Observable<{ grupoComboId: string }> {
    return this.http.post<{ grupoComboId: string }>(
      `${this.base}/${comandaId}/combos`,
      { comboId, quantidade },
    );
  }

  /// Remove todas as linhas de um combo de uma vez (devolve o estoque de
  /// cada componente).
  removerCombo(comandaId: string, grupoComboId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${comandaId}/combos/${grupoComboId}`,
    );
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

  /// Dados do comprovante de uma comanda já fechada (pra 2ª via).
  comprovante(comandaId: string): Observable<DadosComprovante> {
    return this.http.get<DadosComprovante>(
      `${environment.apiUrl}/sales/por-comanda/${comandaId}`,
    );
  }

  fechar(
    comandaId: string,
    pagamentos: PagamentoInput[],
    desconto = 0,
  ): Observable<{ id: string; total: number; desconto: number }> {
    return this.http.post<{ id: string; total: number; desconto: number }>(
      `${this.base}/${comandaId}/fechar`,
      { pagamentos, desconto },
    );
  }
}
