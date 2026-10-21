import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatTableModule } from "@angular/material/table";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";

import {
  DespesasService,
  RelatoriosFinanceirosService,
  RelatorioFinanceiro,
  Despesa,
} from "../../core/services/financeiro.service";
import { DespesaFormDialogComponent } from "./despesa-form-dialog.component";

type PeriodoPreset = "hoje" | "7dias" | "15dias" | "mes" | "personalizado";

/// Tela de controle financeiro: receita (líquida, já com taxa da maquininha
/// descontada) x despesa x lucro, dia a dia, com despesas categorizadas —
/// igual a uma planilha de controle financeiro, só que automática pro lado
/// da receita (que vem das vendas) e manual pro lado da despesa.
@Component({
  selector: "app-financeiro",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    BaseChartDirective,
  ],
  template: `
    <div class="header">
      <h1>Financeiro</h1>
      <button mat-flat-button color="primary" (click)="novaDespesa()">
        <mat-icon>add</mat-icon> Nova despesa
      </button>
    </div>

    <div class="filtro-periodo">
      <mat-button-toggle-group
        [(ngModel)]="preset"
        (ngModelChange)="onPresetChange()"
      >
        <mat-button-toggle value="hoje">Hoje</mat-button-toggle>
        <mat-button-toggle value="7dias">7 dias</mat-button-toggle>
        <mat-button-toggle value="15dias">15 dias</mat-button-toggle>
        <mat-button-toggle value="mes">Este mês</mat-button-toggle>
        <mat-button-toggle value="personalizado"
          >Personalizado</mat-button-toggle
        >
      </mat-button-toggle-group>

      @if (preset === "personalizado") {
        <div class="datas-personalizadas">
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
        </div>
      }
    </div>

    @if (relatorio) {
      <div class="cards">
        <mat-card class="card">
          <span class="label">Receita (líquida)</span>
          <span class="valor positivo"
            >R$ {{ relatorio.totais.totalReceita | number: "1.2-2" }}</span
          >
        </mat-card>
        <mat-card class="card">
          <span class="label">Despesas</span>
          <span class="valor negativo"
            >R$ {{ relatorio.totais.totalDespesa | number: "1.2-2" }}</span
          >
        </mat-card>
        <mat-card class="card destaque">
          <span class="label">Lucro do período</span>
          <span
            class="valor"
            [class.positivo]="relatorio.totais.lucroTotal >= 0"
            [class.negativo]="relatorio.totais.lucroTotal < 0"
          >
            R$ {{ relatorio.totais.lucroTotal | number: "1.2-2" }}
          </span>
        </mat-card>
      </div>

      <div class="graficos">
        <mat-card class="grafico-card grafico-largo">
          <h3>Receita x Despesa x Lucro por dia</h3>
          <canvas baseChart [data]="lucroPorDiaData" type="line"></canvas>
        </mat-card>

        <mat-card class="grafico-card">
          <h3>Despesas por categoria</h3>
          <canvas
            baseChart
            [data]="despesasPorCategoriaData"
            [options]="doughnutOptions"
            type="doughnut"
          ></canvas>
        </mat-card>
      </div>
    }

    <h2>Despesas lançadas</h2>
    <table
      mat-table
      [dataSource]="despesas"
      class="mat-elevation-z1 full-width"
    >
      <ng-container matColumnDef="data">
        <th mat-header-cell *matHeaderCellDef>Data</th>
        <td mat-cell *matCellDef="let d">{{ d.data | date: "dd/MM/yyyy" }}</td>
      </ng-container>
      <ng-container matColumnDef="descricao">
        <th mat-header-cell *matHeaderCellDef>Descrição</th>
        <td mat-cell *matCellDef="let d">{{ d.descricao }}</td>
      </ng-container>
      <ng-container matColumnDef="categoria">
        <th mat-header-cell *matHeaderCellDef>Categoria</th>
        <td mat-cell *matCellDef="let d">{{ d.categoria }}</td>
      </ng-container>
      <ng-container matColumnDef="valor">
        <th mat-header-cell *matHeaderCellDef>Valor</th>
        <td mat-cell *matCellDef="let d" class="negativo">
          R$ {{ d.valor | number: "1.2-2" }}
        </td>
      </ng-container>
      <ng-container matColumnDef="usuario">
        <th mat-header-cell *matHeaderCellDef>Lançado por</th>
        <td mat-cell *matCellDef="let d">{{ d.usuario }}</td>
      </ng-container>
      <ng-container matColumnDef="acoes">
        <th mat-header-cell *matHeaderCellDef>Ações</th>
        <td mat-cell *matCellDef="let d">
          <button mat-icon-button (click)="editar(d)" title="Editar">
            <mat-icon>edit</mat-icon>
          </button>
          <button
            mat-icon-button
            color="warn"
            (click)="remover(d)"
            title="Excluir"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="colunas"></tr>
      <tr mat-row *matRowDef="let row; columns: colunas"></tr>
    </table>

    @if (despesas.length === 0) {
      <p class="vazio">Nenhuma despesa lançada nesse período.</p>
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .filtro-periodo {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin: 12px 0;
      }
      .datas-personalizadas {
        display: flex;
        gap: 8px;
      }
      .data-field {
        width: 150px;
      }

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
      }
      .valor.positivo {
        color: var(--pdv-success);
      }
      .valor.negativo {
        color: var(--pdv-danger);
      }

      .graficos {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 16px;
        margin: 16px 0;
      }
      .grafico-card {
        padding: 16px;
        height: 300px;
        display: flex;
        flex-direction: column;
      }
      .grafico-card h3 {
        margin: 0 0 8px;
        font-size: 0.95rem;
      }
      .grafico-card canvas {
        flex: 1;
        min-height: 0;
      }

      .full-width {
        width: 100%;
        margin-top: 8px;
      }
      .negativo {
        color: var(--pdv-danger);
      }
      .vazio {
        color: #999;
      }

      @media (max-width: 900px) {
        .graficos {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class FinanceiroComponent implements OnInit {
  relatorio: RelatorioFinanceiro | null = null;
  despesas: Despesa[] = [];
  colunas = ["data", "descricao", "categoria", "valor", "usuario", "acoes"];

  preset: PeriodoPreset = "mes";
  dataInicio = "";
  dataFim = "";

  lucroPorDiaData: ChartConfiguration<"line">["data"] = {
    labels: [],
    datasets: [],
  };
  despesasPorCategoriaData: ChartConfiguration<"doughnut">["data"] = {
    labels: [],
    datasets: [{ data: [] }],
  };
  doughnutOptions: ChartConfiguration<"doughnut">["options"] = {
    maintainAspectRatio: false,
    responsive: true,
  };

  constructor(
    private despesasService: DespesasService,
    private relatoriosService: RelatoriosFinanceirosService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const hoje = new Date();
    this.dataFim = this.formatarData(hoje);
    this.dataInicio = this.formatarData(
      new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    );
    this.carregar();
  }

  onPresetChange(): void {
    if (this.preset !== "personalizado") this.carregar();
  }

  private calcularIntervalo(): { inicio: string; fim: string } {
    const hoje = new Date();
    const fim = this.formatarData(hoje);

    switch (this.preset) {
      case "7dias": {
        const inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 6);
        return { inicio: this.formatarData(inicio), fim };
      }
      case "15dias": {
        const inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 14);
        return { inicio: this.formatarData(inicio), fim };
      }
      case "mes": {
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        return { inicio: this.formatarData(inicio), fim };
      }
      case "personalizado":
        return { inicio: this.dataInicio, fim: this.dataFim };
      default:
        return { inicio: fim, fim };
    }
  }

  private formatarData(data: Date): string {
    return data.toISOString().slice(0, 10);
  }

  carregar(): void {
    const { inicio, fim } = this.calcularIntervalo();

    this.relatoriosService.financeiroCompleto(inicio, fim).subscribe((r) => {
      this.relatorio = r;

      this.lucroPorDiaData = {
        labels: r.porDia.map((d) => d.dia),
        datasets: [
          { data: r.porDia.map((d) => d.receita), label: "Receita" },
          { data: r.porDia.map((d) => d.despesa), label: "Despesa" },
          { data: r.porDia.map((d) => d.lucro), label: "Lucro" },
        ],
      };

      this.despesasPorCategoriaData = {
        labels: r.despesasPorCategoria.map((d) => d.categoria),
        datasets: [{ data: r.despesasPorCategoria.map((d) => d.total) }],
      };
    });

    this.despesasService
      .listar(inicio, fim)
      .subscribe((d) => (this.despesas = d));
  }

  novaDespesa(): void {
    const ref = this.dialog.open(DespesaFormDialogComponent, {
      width: "440px",
    });
    ref.afterClosed().subscribe((salvo) => {
      if (salvo) this.carregar();
    });
  }

  editar(despesa: Despesa): void {
    const ref = this.dialog.open(DespesaFormDialogComponent, {
      width: "440px",
      data: { despesa },
    });
    ref.afterClosed().subscribe((salvo) => {
      if (salvo) this.carregar();
    });
  }

  remover(despesa: Despesa): void {
    const confirmou = confirm(`Excluir a despesa "${despesa.descricao}"?`);
    if (!confirmou) return;
    this.despesasService.remover(despesa.id).subscribe(() => this.carregar());
  }
}
