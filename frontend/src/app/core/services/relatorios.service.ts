import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface ItemValorizacao {
  id: string;
  nome: string;
  categoria: string;
  estoqueAtual: number;
  precoCusto: number;
  precoVenda: number;
  valorCusto: number;
  valorVenda: number;
  lucroPercentual: number | null;
}

export interface ValorizacaoEstoque {
  itens: ItemValorizacao[];
  totais: {
    totalCusto: number;
    totalVenda: number;
    lucroBrutoEstimado: number;
    lucroPercentualGeral: number | null;
  };
}

@Injectable({ providedIn: "root" })
export class RelatoriosService {
  private readonly base = `${environment.apiUrl}/reports`;
  constructor(private http: HttpClient) {}

  valorizacaoEstoque(): Observable<ValorizacaoEstoque> {
    return this.http.get<ValorizacaoEstoque>(
      `${this.base}/estoque/valorizacao`,
    );
  }
}
