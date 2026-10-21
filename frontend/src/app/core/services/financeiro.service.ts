import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface CategoriaDespesa {
  id: string;
  nome: string;
}

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoriaDespesaId: string;
  categoria: string;
  usuario: string;
  observacao?: string;
}

export interface DespesaInput {
  descricao: string;
  valor: number;
  data: string;
  categoriaDespesaId: string;
  observacao?: string;
}

export interface RelatorioFinanceiro {
  porDia: { dia: string; receita: number; despesa: number; lucro: number }[];
  despesasPorCategoria: { categoria: string; total: number }[];
  totais: { totalReceita: number; totalDespesa: number; lucroTotal: number };
}

@Injectable({ providedIn: "root" })
export class CategoriasDespesaService {
  private readonly base = `${environment.apiUrl}/despesas/categorias`;
  constructor(private http: HttpClient) {}

  listar(): Observable<CategoriaDespesa[]> {
    return this.http.get<CategoriaDespesa[]>(this.base);
  }

  criar(nome: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.base, { nome });
  }
}

@Injectable({ providedIn: "root" })
export class DespesasService {
  private readonly base = `${environment.apiUrl}/despesas`;
  constructor(private http: HttpClient) {}

  listar(
    inicio?: string,
    fim?: string,
    categoriaId?: string,
  ): Observable<Despesa[]> {
    const params = new URLSearchParams();
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);
    if (categoriaId) params.set("categoriaId", categoriaId);
    const query = params.toString();
    return this.http.get<Despesa[]>(`${this.base}${query ? "?" + query : ""}`);
  }

  criar(despesa: DespesaInput): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.base, despesa);
  }

  editar(id: string, despesa: DespesaInput): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, despesa);
  }

  remover(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: "root" })
export class RelatoriosFinanceirosService {
  private readonly base = `${environment.apiUrl}/reports`;
  constructor(private http: HttpClient) {}

  financeiroCompleto(
    inicio: string,
    fim: string,
  ): Observable<RelatorioFinanceiro> {
    return this.http.get<RelatorioFinanceiro>(
      `${this.base}/financeiro-completo?inicio=${inicio}&fim=${fim}`,
    );
  }
}
