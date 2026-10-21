import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface TaxasCartao {
  taxaCartaoCreditoPercentual: number;
  taxaCartaoDebitoPercentual: number;
  taxaServicoAtiva: boolean;
  taxaServicoPercentual: number;
}

@Injectable({ providedIn: "root" })
export class ConfiguracoesService {
  private readonly base = `${environment.apiUrl}/configuracoes`;
  constructor(private http: HttpClient) {}

  obterTaxas(): Observable<TaxasCartao> {
    return this.http.get<TaxasCartao>(`${this.base}/taxas`);
  }

  atualizarTaxas(taxas: TaxasCartao): Observable<void> {
    return this.http.put<void>(`${this.base}/taxas`, taxas);
  }
}
