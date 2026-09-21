import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";

import {
  DashboardService,
  MetasService,
  Meta,
} from "../../core/services/dashboard.service";
import { NewGoalDialogComponent } from "./new-goal-dialog.component";

type PeriodoPreset = "hoje" | "7dias" | "15dias" | "mes" | "personalizado";

/// Dashboard com dados reais vindos de /api/dashboard/hoje ou
/// /api/dashboard/periodo?inicio=&fim= (vendas por dia, produtos mais
/// vendidos, formas de pagamento) e /api/metas (progresso calculado sobre
/// vendas reais). O seletor de período abaixo do título reusa o mesmo
/// endpoint de período para todos os presets (7/15 dias, mês, ou datas
/// personalizadas) — só muda o intervalo de datas calculado no frontend.
@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatIconModule,
    BaseChartDirective,
  ],
  template: `
    <div class="header">
      <h1>Dashboard</h1>

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
                (change)="carregarResumo()"
              />
            </mat-form-field>
            <mat-form-field appearance="outline" class="data-field">
              <mat-label>Até</mat-label>
              <input
                matInput
                type="date"
                [(ngModel)]="dataFim"
                (change)="carregarResumo()"
              />
            </mat-form-field>
          </div>
        }
      </div>
    </div>

    <div class="cards">
      <mat-card class="card">
        <span class="label">Total vendido no período</span>
        <span class="valor"
          >R$ {{ resumo?.totalVendido ?? 0 | number: "1.2-2" }}</span
        >
      </mat-card>
      <mat-card class="card">
        <span class="label">Número de vendas</span>
        <span class="valor">{{ resumo?.numeroVendas ?? 0 }}</span>
      </mat-card>
      <mat-card class="card">
        <span class="label">Ticket médio</span>
        <span class="valor"
          >R$ {{ resumo?.ticketMedio ?? 0 | number: "1.2-2" }}</span
        >
      </mat-card>
      <mat-card class="card">
        <span class="label">Comandas abertas agora</span>
        <span class="valor">{{ resumo?.comandasAbertas ?? 0 }}</span>
      </mat-card>
    </div>

    <div class="graficos">
      <mat-card class="grafico-card">
        <h3>Vendas por dia</h3>
        <canvas baseChart [data]="vendasPorDiaData" type="line"></canvas>
      </mat-card>

      <mat-card class="grafico-card grafico-pizza">
        <h3>Vendas por forma de pagamento</h3>
        <canvas
          baseChart
          [data]="formaPagamentoData"
          [options]="doughnutOptions"
          type="doughnut"
        ></canvas>
      </mat-card>

      <mat-card class="grafico-card">
        <h3>Produtos mais vendidos</h3>
        <canvas baseChart [data]="produtosMaisVendidosData" type="bar"></canvas>
      </mat-card>
    </div>

    <div class="metas-header">
      <h2>Metas</h2>
      <button mat-stroked-button (click)="novaMeta()">+ Nova meta</button>
    </div>

    <div class="metas-grid">
      @for (meta of metas; track meta.id) {
        <mat-card class="meta-card">
          <div class="meta-topo">
            <p class="meta-desc">
              {{ meta.descricao || meta.tipo + " — meta de faturamento" }}
            </p>
            <div class="meta-acoes">
              <button
                mat-icon-button
                (click)="editarMeta(meta)"
                title="Editar meta"
              >
                <mat-icon>edit</mat-icon>
              </button>
              <button
                mat-icon-button
                color="warn"
                (click)="excluirMeta(meta)"
                title="Excluir meta"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
          <p class="meta-valores">
            Meta: R$ {{ meta.valorAlvo | number: "1.2-2" }} · Realizado: R$
            {{ meta.realizado | number: "1.2-2" }}
          </p>
          <div class="barra">
            <div
              class="barra-preenchida"
              [style.width.%]="meta.percentual > 100 ? 100 : meta.percentual"
            ></div>
          </div>
          <span class="percentual">{{ meta.percentual }}%</span>
        </mat-card>
      } @empty {
        <p class="vazio">Nenhuma meta cadastrada ainda.</p>
      }
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .filtro-periodo {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
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
        min-width: 180px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .label {
        color: #777;
        font-size: 0.85rem;
      }
      .valor {
        font-size: 1.7rem;
        font-weight: 700;
        color: var(--pdv-primary);
      }

      .graficos {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin: 24px 0;
      }
      .grafico-card {
        padding: 16px;
        height: 280px;
        display: flex;
        flex-direction: column;
      }
      .grafico-pizza {
        height: 280px;
      }
      .grafico-card h3 {
        margin: 0 0 8px;
        font-size: 0.95rem;
      }
      .grafico-card canvas {
        flex: 1;
        min-height: 0;
      }

      .metas-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
      }
      .metas-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .meta-card {
        padding: 16px;
      }
      .meta-topo {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 4px;
      }
      .meta-acoes {
        display: flex;
        flex-shrink: 0;
      }
      .meta-desc {
        font-weight: 600;
        margin: 0 0 4px;
      }
      .meta-valores {
        font-size: 0.85rem;
        color: #666;
        margin: 0 0 8px;
      }
      .barra {
        background: #e0e0e0;
        border-radius: 6px;
        height: 10px;
        overflow: hidden;
      }
      .barra-preenchida {
        background: var(--pdv-accent);
        height: 100%;
      }
      .percentual {
        font-size: 0.85rem;
        color: #555;
      }
      .vazio {
        color: #999;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  resumo: import("../../core/services/dashboard.service").ResumoPeriodo | null =
    null;
  metas: Meta[] = [];

  preset: PeriodoPreset = "hoje";
  dataInicio = "";
  dataFim = "";

  vendasPorDiaData: ChartConfiguration<"line">["data"] = {
    labels: [],
    datasets: [{ data: [], label: "Total (R$)" }],
  };
  formaPagamentoData: ChartConfiguration<"doughnut">["data"] = {
    labels: [],
    datasets: [{ data: [] }],
  };

  produtosMaisVendidosData: ChartConfiguration<"bar">["data"] = {
    labels: [],
    datasets: [{ data: [], label: "Quantidade" }],
  };

  doughnutOptions: ChartConfiguration<"doughnut">["options"] = {
    maintainAspectRatio: false,
    responsive: true,
  };

  constructor(
    private dashboardService: DashboardService,
    private metasService: MetasService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const hoje = new Date();
    this.dataFim = this.formatarData(hoje);
    this.dataInicio = this.formatarData(hoje);

    this.carregarResumo();
    this.carregarMetas();
  }

  onPresetChange(): void {
    if (this.preset !== "personalizado") this.carregarResumo();
  }

  carregarResumo(): void {
    const { inicio, fim } = this.calcularIntervalo();

    const request$ =
      this.preset === "hoje"
        ? this.dashboardService.hoje()
        : this.dashboardService.periodo(inicio, fim);

    request$.subscribe((resumo) => {
      this.resumo = resumo;

      this.vendasPorDiaData = {
        labels: resumo.vendasPorDia.map((v) => v.dia),
        datasets: [
          {
            data: resumo.vendasPorDia.map((v) => v.total),
            label: "Total (R$)",
          },
        ],
      };

      this.formaPagamentoData = {
        labels: resumo.porFormaPagamento.map((p) => p.forma),
        datasets: [{ data: resumo.porFormaPagamento.map((p) => p.total) }],
      };

      this.produtosMaisVendidosData = {
        labels: resumo.produtosMaisVendidos.map((p) => p.produto),
        datasets: [
          {
            data: resumo.produtosMaisVendidos.map((p) => p.quantidade),
            label: "Quantidade",
          },
        ],
      };
    });
  }

  /// Calcula o intervalo [inicio, fim] (formato yyyy-MM-dd) de acordo com o
  /// preset selecionado. Para "personalizado", usa as datas escolhidas
  /// pelo usuário nos campos de data.
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
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  }

  carregarMetas(): void {
    this.metasService.listar().subscribe((m) => (this.metas = m));
  }

  novaMeta(): void {
    const ref = this.dialog.open(NewGoalDialogComponent, { width: "380px" });
    ref.afterClosed().subscribe((criado) => {
      if (criado) this.carregarMetas();
    });
  }

  editarMeta(meta: Meta): void {
    const ref = this.dialog.open(NewGoalDialogComponent, {
      width: "380px",
      data: { meta },
    });
    ref.afterClosed().subscribe((salvo) => {
      if (salvo) this.carregarMetas();
    });
  }

  excluirMeta(meta: Meta): void {
    const confirmou = confirm(
      `Excluir a meta "${meta.descricao || meta.tipo}"? Essa ação não pode ser desfeita.`,
    );
    if (!confirmou) return;

    this.metasService.remover(meta.id).subscribe(() => this.carregarMetas());
  }
}
