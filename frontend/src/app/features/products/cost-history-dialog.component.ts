import { Component, Inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatTableModule } from "@angular/material/table";
import {
  ProdutosService,
  HistoricoCustoItem,
} from "../../core/services/produtos.service";

export interface CostHistoryDialogData {
  produtoId: string;
  produtoNome: string;
  precoCustoAtual: number;
}

/// Mostra todas as entradas de estoque em que um preço de custo foi
/// informado, em ordem cronológica — dá pra ver quanto se pagava antes vs.
/// quanto se paga hoje pelo mesmo produto.
@Component({
  selector: "app-cost-history-dialog",
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatTableModule],
  template: `
    <h2 mat-dialog-title>Histórico de custo — {{ data.produtoNome }}</h2>
    <div mat-dialog-content>
      <p class="atual">
        Custo atual:
        <strong>R$ {{ data.precoCustoAtual | number: "1.2-2" }}</strong>
      </p>

      @if (historico.length > 0) {
        <table mat-table [dataSource]="historico" class="full-width">
          <ng-container matColumnDef="data">
            <th mat-header-cell *matHeaderCellDef>Data</th>
            <td mat-cell *matCellDef="let h">
              {{ h.createdAt | date: "dd/MM/yyyy" }}
            </td>
          </ng-container>
          <ng-container matColumnDef="custo">
            <th mat-header-cell *matHeaderCellDef>Custo pago</th>
            <td mat-cell *matCellDef="let h">
              R$ {{ h.precoCusto | number: "1.2-2" }}
            </td>
          </ng-container>
          <ng-container matColumnDef="quantidade">
            <th mat-header-cell *matHeaderCellDef>Quantidade</th>
            <td mat-cell *matCellDef="let h">{{ h.quantidade }}</td>
          </ng-container>
          <ng-container matColumnDef="variacao">
            <th mat-header-cell *matHeaderCellDef>Variação</th>
            <td
              mat-cell
              *matCellDef="let h; let i = index"
              [class.subiu]="variacao(i) > 0"
              [class.desceu]="variacao(i) < 0"
            >
              @if (i > 0) {
                {{ variacao(i) > 0 ? "+" : ""
                }}{{ variacao(i) | number: "1.1-1" }}%
              } @else {
                —
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="colunas"></tr>
          <tr mat-row *matRowDef="let row; columns: colunas"></tr>
        </table>
      } @else {
        <p class="vazio">
          Nenhuma entrada com preço de custo registrado ainda.
        </p>
      }
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fechar</button>
    </div>
  `,
  styles: [
    `
      .atual {
        color: #666;
        margin-top: 0;
      }
      .full-width {
        width: 100%;
        min-width: 380px;
      }
      .vazio {
        color: #999;
      }
      .subiu {
        color: var(--pdv-danger);
        font-weight: 600;
      }
      .desceu {
        color: var(--pdv-success);
        font-weight: 600;
      }
    `,
  ],
})
export class CostHistoryDialogComponent implements OnInit {
  historico: HistoricoCustoItem[] = [];
  colunas = ["data", "custo", "quantidade", "variacao"];

  constructor(
    private produtosService: ProdutosService,
    @Inject(MAT_DIALOG_DATA) public data: CostHistoryDialogData,
  ) {}

  ngOnInit(): void {
    this.produtosService
      .historicoCusto(this.data.produtoId)
      .subscribe((h) => (this.historico = h));
  }

  variacao(index: number): number {
    if (index === 0) return 0;
    const anterior = this.historico[index - 1].precoCusto;
    const atual = this.historico[index].precoCusto;
    if (anterior === 0) return 0;
    return Math.round(((atual - anterior) / anterior) * 1000) / 10;
  }
}
