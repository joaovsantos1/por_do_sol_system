import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface ComboItemInput {
  produtoId: string;
  quantidade: number;
}

export interface Combo {
  id: string;
  nome: string;
  descricao?: string;
  precoVenda: number;
  ativo: boolean;
  precoAvulsoReferencia: number;
  itens: { produtoId: string; produtoNome: string; quantidade: number }[];
}

@Injectable({ providedIn: "root" })
export class CombosService {
  private readonly base = `${environment.apiUrl}/combos`;
  constructor(private http: HttpClient) {}

  listar(somenteAtivos = true): Observable<Combo[]> {
    return this.http.get<Combo[]>(
      `${this.base}?somenteAtivos=${somenteAtivos}`,
    );
  }

  criar(combo: {
    nome: string;
    descricao?: string;
    precoVenda: number;
    itens: ComboItemInput[];
  }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.base, combo);
  }

  editar(
    id: string,
    combo: {
      nome: string;
      descricao?: string;
      precoVenda: number;
      itens: ComboItemInput[];
    },
  ): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, combo);
  }

  alternarAtivo(id: string, ativo: boolean): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/${id}/${ativo ? "ativar" : "inativar"}`,
      {},
    );
  }
}
