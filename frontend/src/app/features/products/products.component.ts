import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { MatTableModule } from "@angular/material/table";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatChipsModule } from "@angular/material/chips";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { environment } from "../../../environments/environment";
import { AddStockDialogComponent } from "./add-stock-dialog.component";

import { ProdutosService, Produto } from "../../core/services/produtos.service";
import { ProductFormDialogComponent } from "./product-form-dialog.component";

@Component({
  selector: "app-products",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="header">
      <h1>Produtos</h1>
      <button mat-flat-button color="primary" (click)="novoProduto()">
        <mat-icon>add</mat-icon> Novo produto
      </button>
    </div>

    <mat-form-field appearance="outline" style="max-width: 320px;">
      <mat-label>Buscar por nome ou código</mat-label>
      <input matInput [(ngModel)]="busca" (ngModelChange)="buscar()" />
    </mat-form-field>

    <table
      mat-table
      [dataSource]="produtos"
      class="mat-elevation-z1 full-width"
    >
      <ng-container matColumnDef="nome">
        <th mat-header-cell *matHeaderCellDef>Nome</th>
        <td mat-cell *matCellDef="let p">{{ p.nome }}</td>
      </ng-container>
      <ng-container matColumnDef="categoria">
        <th mat-header-cell *matHeaderCellDef>Categoria</th>
        <td mat-cell *matCellDef="let p">{{ p.categoria }}</td>
      </ng-container>
      <ng-container matColumnDef="preco">
        <th mat-header-cell *matHeaderCellDef>Preço</th>
        <td mat-cell *matCellDef="let p">
          R$ {{ p.precoVenda | number: "1.2-2" }}
        </td>
      </ng-container>
      <ng-container matColumnDef="estoque">
        <th mat-header-cell *matHeaderCellDef>Estoque</th>
        <td mat-cell *matCellDef="let p">
          <mat-chip [color]="p.estoqueBaixo ? 'warn' : undefined" selected>{{
            p.estoqueAtual
          }}</mat-chip>
        </td>
      </ng-container>
      <ng-container matColumnDef="acoes">
        <th mat-header-cell *matHeaderCellDef>Ações</th>
        <td mat-cell *matCellDef="let p">
          <button
            mat-icon-button
            (click)="adicionarEstoque(p)"
            title="Adicionar estoque"
          >
            <mat-icon>add_box</mat-icon>
          </button>
          <button mat-icon-button (click)="editar(p)" title="Editar">
            <mat-icon>edit</mat-icon>
          </button>
          <button
            mat-icon-button
            (click)="alternarAtivo(p)"
            [title]="p.ativo ? 'Inativar' : 'Ativar'"
          >
            <mat-icon>{{ p.ativo ? "visibility_off" : "visibility" }}</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="colunas"></tr>
      <tr mat-row *matRowDef="let row; columns: colunas"></tr>
    </table>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .full-width {
        width: 100%;
        margin-top: 12px;
      }
    `,
  ],
})
export class ProductsComponent implements OnInit {
  produtos: Produto[] = [];
  busca = "";
  colunas = ["nome", "categoria", "preco", "estoque", "acoes"];

  constructor(
    private produtosService: ProdutosService,
    private dialog: MatDialog,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.produtosService
      .listar(this.busca)
      .subscribe((p) => (this.produtos = p));
  }

  novoProduto(): void {
    const ref = this.dialog.open(ProductFormDialogComponent, {
      width: "420px",
    });
    ref.afterClosed().subscribe((criado) => {
      if (criado) this.buscar();
    });
  }

  editar(produto: Produto): void {
    const ref = this.dialog.open(ProductFormDialogComponent, {
      width: "420px",
      data: { produto },
    });
    ref.afterClosed().subscribe((editado) => {
      if (editado) this.buscar();
    });
  }

  alternarAtivo(produto: Produto): void {
    const acao = produto.ativo ? "inativar" : "ativar";
    this.http
      .patch(`${environment.apiUrl}/produtos/${produto.id}/${acao}`, {})
      .subscribe(() => this.buscar());
  }

  adicionarEstoque(produto: Produto): void {
    const ref = this.dialog.open(AddStockDialogComponent, {
      width: "360px",
      data: {
        produtoId: produto.id,
        produtoNome: produto.nome,
        estoqueAtual: produto.estoqueAtual,
      },
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (confirmado) this.buscar();
    });
  }
}
