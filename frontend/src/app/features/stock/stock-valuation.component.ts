import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatCardModule } from "@angular/material/card";
import { MatTableModule } from "@angular/material/table";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";

import {
  RelatoriosService,
  ItemValorizacao,
  ValorizacaoEstoque,
} from "../../core/services/relatorios.service";

/// Quanto o estoque atual vale a preço de custo e a preço de venda, e o
/// percentual de lucro (markup sobre o custo) — por produto e no total
/// geral. Só considera produtos ativos (ver comentário no backend).
@Component({
  selector: "app-stock-valuation",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h1>Valorização de estoque</h1>

    @if (dados) {
      <div class="cards">
        <mat-card class="card">
          <span class="label">Valor total (preço de custo)</span>
          <span class="valor"
            >R$ {{ dados.totais.totalCusto | number: "1.2-2" }}</span
          >
        </mat-card>
        <mat-card class="card">
          <span class="label">Valor total (preço de venda)</span>
          <span class="valor"
            >R$ {{ dados.totais.totalVenda | number: "1.2-2" }}</span
          >
        </mat-card>
        <mat-card class="card">
          <span class="label">Lucro bruto estimado</span>
          <span class="valor"
            >R$ {{ dados.totais.lucroBrutoEstimado | number: "1.2-2" }}</span
          >
        </mat-card>
        <mat-card class="card destaque">
          <span class="label">Lucro % geral (sobre o custo)</span>
          <span class="valor">
            {{
              dados.totais.lucroPercentualGeral !== null
                ? dados.totais.lucroPercentualGeral + "%"
                : "—"
            }}
          </span>
        </mat-card>
      </div>

      <mat-form-field
        appearance="outline"
        style="max-width: 300px; margin-top: 8px;"
      >
        <mat-label>Buscar produto</mat-label>
        <input matInput [(ngModel)]="busca" />
      </mat-form-field>

      <table
        mat-table
        [dataSource]="itensFiltrados"
        class="mat-elevation-z1 full-width"
      >
        <ng-container matColumnDef="nome">
          <th mat-header-cell *matHeaderCellDef>Produto</th>
          <td mat-cell *matCellDef="let i">
            {{ i.nome }}
            <div class="sub">{{ i.categoria }}</div>
          </td>
        </ng-container>
        <ng-container matColumnDef="estoque">
          <th mat-header-cell *matHeaderCellDef>Estoque</th>
          <td mat-cell *matCellDef="let i">{{ i.estoqueAtual }}</td>
        </ng-container>
        <ng-container matColumnDef="precoCusto">
          <th mat-header-cell *matHeaderCellDef>Custo (un.)</th>
          <td mat-cell *matCellDef="let i">
            R$ {{ i.precoCusto | number: "1.2-2" }}
          </td>
        </ng-container>
        <ng-container matColumnDef="precoVenda">
          <th mat-header-cell *matHeaderCellDef>Venda (un.)</th>
          <td mat-cell *matCellDef="let i">
            R$ {{ i.precoVenda | number: "1.2-2" }}
          </td>
        </ng-container>
        <ng-container matColumnDef="valorCusto">
          <th mat-header-cell *matHeaderCellDef>Total custo</th>
          <td mat-cell *matCellDef="let i">
            R$ {{ i.valorCusto | number: "1.2-2" }}
          </td>
        </ng-container>
        <ng-container matColumnDef="valorVenda">
          <th mat-header-cell *matHeaderCellDef>Total venda</th>
          <td mat-cell *matCellDef="let i">
            R$ {{ i.valorVenda | number: "1.2-2" }}
          </td>
        </ng-container>
        <ng-container matColumnDef="lucro">
          <th mat-header-cell *matHeaderCellDef>Lucro %</th>
          <td
            mat-cell
            *matCellDef="let i"
            [class.lucro-negativo]="(i.lucroPercentual ?? 0) < 0"
          >
            {{ i.lucroPercentual !== null ? i.lucroPercentual + "%" : "—" }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="colunas"></tr>
        <tr mat-row *matRowDef="let row; columns: colunas"></tr>
      </table>
    }
  `,
  styles: [
    `
      .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin: 16px 0;
      }
      .card {
        padding: 20px;
        min-width: 200px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .card.destaque {
        border-left: 4px solid var(--pdv-accent);
      }
      .label {
        color: #777;
        font-size: 0.85rem;
      }
      .valor {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--pdv-primary);
      }
      .full-width {
        width: 100%;
        margin-top: 12px;
      }
      .sub {
        font-size: 0.75rem;
        color: #999;
      }
      .lucro-negativo {
        color: var(--pdv-danger);
        font-weight: 700;
      }
    `,
  ],
})
export class StockValuationComponent implements OnInit {
  dados: ValorizacaoEstoque | null = null;
  busca = "";
  colunas = [
    "nome",
    "estoque",
    "precoCusto",
    "precoVenda",
    "valorCusto",
    "valorVenda",
    "lucro",
  ];

  constructor(private relatoriosService: RelatoriosService) {}

  ngOnInit(): void {
    this.relatoriosService
      .valorizacaoEstoque()
      .subscribe((dados) => (this.dados = dados));
  }

  get itensFiltrados(): ItemValorizacao[] {
    if (!this.dados) return [];
    if (!this.busca.trim()) return this.dados.itens;
    const termo = this.busca.toLowerCase();
    return this.dados.itens.filter(
      (i) =>
        i.nome.toLowerCase().includes(termo) ||
        i.categoria.toLowerCase().includes(termo),
    );
  }
}
