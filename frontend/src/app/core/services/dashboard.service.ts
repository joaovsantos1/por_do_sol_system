import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface ResumoPeriodo {
  totalVendido: number;
  numeroVendas: number;
  ticketMedio: number;
  comandasAbertas: number;
  comandasFechadas: number;
  porFormaPagamento: { forma: string; total: number }[];
  vendasPorDia: { dia: string; total: number }[];
  produtosMaisVendidos: { produto: string; quantidade: number }[];
}

@Injectable({ providedIn: "root" })
export class DashboardService {
  private readonly base = `${environment.apiUrl}/dashboard`;
  constructor(private http: HttpClient) {}

  hoje(): Observable<ResumoPeriodo> {
    return this.http.get<ResumoPeriodo>(`${this.base}/hoje`);
  }

  periodo(inicio: string, fim: string): Observable<ResumoPeriodo> {
    return this.http.get<ResumoPeriodo>(
      `${this.base}/periodo?inicio=${inicio}&fim=${fim}`,
    );
  }
}

export interface Meta {
  id: string;
  tipo: string;
  periodoInicio: string;
  periodoFim: string;
  valorAlvo: number;
  descricao?: string;
  realizado: number;
  percentual: number;
}

@Injectable({ providedIn: "root" })
export class MetasService {
  private readonly base = `${environment.apiUrl}/metas`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Meta[]> {
    return this.http.get<Meta[]>(this.base);
  }

  criar(meta: {
    tipo: string;
    periodoInicio: string;
    periodoFim: string;
    valorAlvo: number;
    descricao?: string;
  }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.base, meta);
  }

  editar(
    id: string,
    meta: {
      tipo: string;
      periodoInicio: string;
      periodoFim: string;
      valorAlvo: number;
      descricao?: string;
    },
  ): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, meta);
  }

  remover(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
