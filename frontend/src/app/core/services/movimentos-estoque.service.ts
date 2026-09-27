import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface MovimentoEstoque {
  id: string;
  produto: string;
  tipo: string;
  quantidade: number;
  estoqueResultante: number;
  usuario: string;
  createdAt: string;
  observacao?: string;
  precoCustoRegistrado?: number;
}

@Injectable({ providedIn: "root" })
export class MovimentosEstoqueService {
  private readonly base = `${environment.apiUrl}/estoque`;
  constructor(private http: HttpClient) {}

  listarTodos(filtros: {
    tipo?: string;
    produtoId?: string;
    inicio?: string;
    fim?: string;
  }): Observable<MovimentoEstoque[]> {
    const params = new URLSearchParams();
    if (filtros.tipo) params.set("tipo", filtros.tipo);
    if (filtros.produtoId) params.set("produtoId", filtros.produtoId);
    if (filtros.inicio) params.set("inicio", filtros.inicio);
    if (filtros.fim) params.set("fim", filtros.fim);
    const query = params.toString();
    return this.http.get<MovimentoEstoque[]>(
      `${this.base}/movimentos${query ? "?" + query : ""}`,
    );
  }
}
