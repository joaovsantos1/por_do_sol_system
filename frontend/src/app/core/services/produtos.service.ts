import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface Produto {
  id: string;
  codigo: string;
  codigoBarras?: string;
  nome: string;
  descricao?: string;
  precoVenda: number;
  precoCusto: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  estoqueBaixo: boolean;
  categoriaId: string;
  categoria: string;
  unidade: string;
  ativo: boolean;
  imagemUrl?: string;
}

@Injectable({ providedIn: "root" })
export class ProdutosService {
  private readonly base = `${environment.apiUrl}/produtos`;

  constructor(private http: HttpClient) {}

  listar(busca?: string, categoriaId?: string): Observable<Produto[]> {
    let url = `${this.base}?somenteAtivos=true`;
    if (busca) url += `&busca=${encodeURIComponent(busca)}`;
    if (categoriaId) url += `&categoriaId=${categoriaId}`;
    return this.http.get<Produto[]>(url);
  }

  estoqueBaixo(): Observable<
    { id: string; nome: string; estoqueAtual: number; estoqueMinimo: number }[]
  > {
    return this.http.get<
      {
        id: string;
        nome: string;
        estoqueAtual: number;
        estoqueMinimo: number;
      }[]
    >(`${this.base}/estoque-baixo`);
  }
}

export interface Categoria {
  id: string;
  nome: string;
}

@Injectable({ providedIn: "root" })
export class CategoriasService {
  private readonly base = `${environment.apiUrl}/categorias`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.base);
  }

  criar(nome: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.base, { nome });
  }
}
