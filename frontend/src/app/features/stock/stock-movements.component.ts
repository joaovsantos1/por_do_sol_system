import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatChipsModule } from "@angular/material/chips";

import {
  MovimentosEstoqueService,
  MovimentoEstoque,
} from "../../core/services/movimentos-estoque.service";

/// Controle geral de entrada e saída de estoque — todas as movimentações
/// de todos os produtos, com filtro por tipo e período. Complementa a tela
/// de "Estoque" (que só mostra alerta de estoque baixo) e a de
/// "Valorização" (que mostra o valor financeiro do estoque atual).
@Component({
  selector: "app-stock-movements",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
  ],
  template: `
    <h1>Movimentações de estoque</h1>

    <div class="filtros">
      <mat-form-field appearance="outline" class="tipo-field">
        <mat-label>Tipo</mat-label>
        <mat-select [(ngModel)]="tipo" (ngModelChange)="carregar()">
          <mat-option [value]="undefined">Todos</mat-option>
          <mat-option value="Entrada">Entrada</mat-option>
          <mat-option value="SaidaVenda">Saída (venda)</mat-option>
          <mat-option value="Ajuste">Ajuste</mat-option>
          <mat-option value="CancelamentoVenda"
            >Cancelamento de venda</mat-option
          >
          <mat-option value="Devolucao">Devolução</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="data-field">
        <mat-label>De</mat-label>
        <input
          matInput
          type="date"
          [(ngModel)]="dataInicio"
          (change)="carregar()"
        />
      </mat-form-field>
      <mat-form-field appearance="outline" class="data-field">
        <mat-label>Até</mat-label>
        <input
          matInput
          type="date"
          [(ngModel)]="dataFim"
          (change)="carregar()"
        />
      </mat-form-field>

      <mat-form-field appearance="outline" class="busca-field">
        <mat-label>Buscar produto</mat-label>
        <input matInput [(ngModel)]="busca" />
      </mat-form-field>
    </div>

    <table
      mat-table
      [dataSource]="movimentosFiltrados"
      class="mat-elevation-z1 full-width"
    >
      <ng-container matColumnDef="data">
        <th mat-header-cell *matHeaderCellDef>Data</th>
        <td mat-cell *matCellDef="let m">
          {{ m.createdAt | date: "dd/MM/yyyy HH:mm" }}
        </td>
      </ng-container>
      <ng-container matColumnDef="produto">
        <th mat-header-cell *matHeaderCellDef>Produto</th>
        <td mat-cell *matCellDef="let m">{{ m.produto }}</td>
      </ng-container>
      <ng-container matColumnDef="tipo">
        <th mat-header-cell *matHeaderCellDef>Tipo</th>
        <td mat-cell *matCellDef="let m">
          <mat-chip [color]="corDoTipo(m.tipo)" selected>{{
            rotuloTipo(m.tipo)
          }}</mat-chip>
        </td>
      </ng-container>
      <ng-container matColumnDef="quantidade">
        <th mat-header-cell *matHeaderCellDef>Quantidade</th>
        <td
          mat-cell
          *matCellDef="let m"
          [class.positivo]="m.quantidade > 0"
          [class.negativo]="m.quantidade < 0"
        >
          {{ m.quantidade > 0 ? "+" : "" }}{{ m.quantidade }}
        </td>
      </ng-container>
      <ng-container matColumnDef="resultante">
        <th mat-header-cell *matHeaderCellDef>Estoque após</th>
        <td mat-cell *matCellDef="let m">{{ m.estoqueResultante }}</td>
      </ng-container>
      <ng-container matColumnDef="custo">
        <th mat-header-cell *matHeaderCellDef>Custo registrado</th>
        <td mat-cell *matCellDef="let m">
          {{
            m.precoCustoRegistrado
              ? "R$ " + (m.precoCustoRegistrado | number: "1.2-2")
              : "—"
          }}
        </td>
      </ng-container>
      <ng-container matColumnDef="usuario">
        <th mat-header-cell *matHeaderCellDef>Usuário</th>
        <td mat-cell *matCellDef="let m">{{ m.usuario }}</td>
      </ng-container>
      <ng-container matColumnDef="observacao">
        <th mat-header-cell *matHeaderCellDef>Observação</th>
        <td mat-cell *matCellDef="let m" class="obs">
          {{ m.observacao || "—" }}
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="colunas"></tr>
      <tr mat-row *matRowDef="let row; columns: colunas"></tr>
    </table>

    @if (movimentosFiltrados.length === 0) {
      <p class="vazio">Nenhuma movimentação encontrada para esse filtro.</p>
    }
  `,
  styles: [
    `
      .filtros {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 12px;
      }
      .tipo-field {
        width: 200px;
      }
      .data-field {
        width: 150px;
      }
      .busca-field {
        width: 220px;
      }
      .full-width {
        width: 100%;
      }
      .positivo {
        color: var(--pdv-success);
        font-weight: 600;
      }
      .negativo {
        color: var(--pdv-danger);
        font-weight: 600;
      }
      .obs {
        font-size: 0.8rem;
        color: #777;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vazio {
        color: #999;
        margin-top: 16px;
      }
    `,
  ],
})
export class StockMovementsComponent implements OnInit {
  movimentos: MovimentoEstoque[] = [];
  colunas = [
    "data",
    "produto",
    "tipo",
    "quantidade",
    "resultante",
    "custo",
    "usuario",
    "observacao",
  ];

  tipo?: string;
  dataInicio = "";
  dataFim = "";
  busca = "";

  private readonly rotulos: Record<string, string> = {
    Entrada: "Entrada",
    SaidaVenda: "Saída (venda)",
    Ajuste: "Ajuste",
    CancelamentoVenda: "Estorno de venda",
    Devolucao: "Devolução",
  };

  constructor(private movimentosService: MovimentosEstoqueService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.movimentosService
      .listarTodos({
        tipo: this.tipo,
        inicio: this.dataInicio || undefined,
        fim: this.dataFim || undefined,
      })
      .subscribe((m) => (this.movimentos = m));
  }

  get movimentosFiltrados(): MovimentoEstoque[] {
    if (!this.busca.trim()) return this.movimentos;
    const termo = this.busca.toLowerCase();
    return this.movimentos.filter((m) =>
      m.produto.toLowerCase().includes(termo),
    );
  }

  rotuloTipo(tipo: string): string {
    return this.rotulos[tipo] ?? tipo;
  }

  corDoTipo(tipo: string): "primary" | "warn" | undefined {
    if (tipo === "Entrada" || tipo === "Devolucao") return "primary";
    if (tipo === "SaidaVenda" || tipo === "CancelamentoVenda") return "warn";
    return undefined;
  }
}
