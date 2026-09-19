import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatChipsModule } from "@angular/material/chips";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";

import {
  ComandasService,
  ComandaHistorico,
} from "../../core/services/comandas.service";
import { CommandItemsDialogComponent } from "./command-items-dialog.component";

type StatusFiltro = "Todas" | "Aberta" | "Fechada" | "Cancelada";

/// Histórico de comandas (independente da tela de "Comandas Abertas", que
/// continua existindo pro fluxo rápido do caixa). Permite ver comandas
/// fechadas/canceladas de qualquer período — incluindo os itens vendidos
/// em cada uma — além de cancelar uma comanda aberta ou estornar uma já
/// fechada direto daqui.
@Component({
  selector: "app-commands-history",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatDialogModule,
  ],
  template: `
    <h1>Histórico de comandas</h1>

    <div class="filtros">
      <mat-button-toggle-group
        [(ngModel)]="statusFiltro"
        (ngModelChange)="carregar()"
      >
        <mat-button-toggle value="Todas">Todas</mat-button-toggle>
        <mat-button-toggle value="Aberta">Abertas</mat-button-toggle>
        <mat-button-toggle value="Fechada">Fechadas</mat-button-toggle>
        <mat-button-toggle value="Cancelada">Canceladas</mat-button-toggle>
      </mat-button-toggle-group>

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

    @if (erro) {
      <p class="erro">{{ erro }}</p>
    }

    <table
      mat-table
      [dataSource]="comandas"
      class="mat-elevation-z1 full-width"
    >
      <ng-container matColumnDef="numero">
        <th mat-header-cell *matHeaderCellDef>Comanda</th>
        <td mat-cell *matCellDef="let c">
          #{{ c.numero }}
          @if (c.numeroMesa) {
            <div class="sub">Mesa {{ c.numeroMesa }}</div>
          }
          @if (c.nomeCliente) {
            <div class="sub">{{ c.nomeCliente }}</div>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let c">
          <mat-chip [color]="corDoStatus(c.status)" selected>{{
            c.status
          }}</mat-chip>
        </td>
      </ng-container>
      <ng-container matColumnDef="abertaEm">
        <th mat-header-cell *matHeaderCellDef>Aberta em</th>
        <td mat-cell *matCellDef="let c">
          {{ c.abertaEm | date: "dd/MM HH:mm" }} — {{ c.abertaPor }}
        </td>
      </ng-container>
      <ng-container matColumnDef="fechadaEm">
        <th mat-header-cell *matHeaderCellDef>Fechada em</th>
        <td mat-cell *matCellDef="let c">
          {{
            c.fechadaEm
              ? (c.fechadaEm | date: "dd/MM HH:mm") + " — " + c.fechadaPor
              : "—"
          }}
        </td>
      </ng-container>
      <ng-container matColumnDef="total">
        <th mat-header-cell *matHeaderCellDef>Total</th>
        <td mat-cell *matCellDef="let c">
          R$ {{ c.valorTotal | number: "1.2-2" }}
        </td>
      </ng-container>
      <ng-container matColumnDef="acoes">
        <th mat-header-cell *matHeaderCellDef>Ações</th>
        <td mat-cell *matCellDef="let c">
          <button
            mat-icon-button
            (click)="verItens(c)"
            title="Ver itens da comanda"
          >
            <mat-icon>receipt_long</mat-icon>
          </button>
          @if (c.status === "Aberta") {
            <button
              mat-icon-button
              color="warn"
              (click)="cancelarComanda(c)"
              title="Cancelar comanda"
            >
              <mat-icon>cancel</mat-icon>
            </button>
          }
          @if (c.status === "Fechada") {
            <button
              mat-icon-button
              color="warn"
              (click)="estornarComanda(c)"
              title="Estornar (cancelar venda e devolver estoque)"
            >
              <mat-icon>undo</mat-icon>
            </button>
          }
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="colunas"></tr>
      <tr mat-row *matRowDef="let row; columns: colunas"></tr>
    </table>

    @if (comandas.length === 0 && !erro) {
      <p class="vazio">Nenhuma comanda encontrada para esse filtro.</p>
    }
  `,
  styles: [
    `
      .filtros {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .data-field {
        width: 150px;
      }
      .full-width {
        width: 100%;
      }
      .vazio {
        color: #999;
        margin-top: 16px;
      }
      .erro {
        color: var(--pdv-danger);
        margin: 8px 0;
      }
      .sub {
        font-size: 0.75rem;
        color: #777;
      }
    `,
  ],
})
export class CommandsHistoryComponent implements OnInit {
  comandas: ComandaHistorico[] = [];
  colunas = ["numero", "status", "abertaEm", "fechadaEm", "total", "acoes"];

  statusFiltro: StatusFiltro = "Fechada";
  dataInicio = "";
  dataFim = "";
  erro = "";

  constructor(
    private comandasService: ComandasService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.erro = "";
    const status =
      this.statusFiltro === "Todas" ? undefined : this.statusFiltro;

    this.comandasService
      .historico(
        status,
        this.dataInicio || undefined,
        this.dataFim || undefined,
      )
      .subscribe({
        next: (c) => (this.comandas = c),
        error: (err) => {
          this.comandas = [];
          this.erro =
            err.error?.erro ||
            "Não foi possível carregar o histórico com esse filtro.";
        },
      });
  }

  corDoStatus(status: string): "primary" | "warn" | undefined {
    if (status === "Aberta") return "primary";
    if (status === "Cancelada") return "warn";
    return undefined;
  }

  verItens(comanda: ComandaHistorico): void {
    this.dialog.open(CommandItemsDialogComponent, {
      width: "400px",
      data: comanda,
    });
  }

  cancelarComanda(comanda: ComandaHistorico): void {
    const confirmou = confirm(
      `Cancelar a comanda #${comanda.numero}? Os itens voltam ao estoque. Essa ação não pode ser desfeita.`,
    );
    if (!confirmou) return;

    this.comandasService.cancelar(comanda.id).subscribe(() => this.carregar());
  }

  estornarComanda(comanda: ComandaHistorico): void {
    const motivo = prompt(`Motivo do estorno da comanda #${comanda.numero}:`);
    if (!motivo) return;

    this.comandasService.estornar(comanda.id, motivo).subscribe({
      next: () => this.carregar(),
      error: () =>
        alert(
          "Não foi possível estornar essa comanda — verifique se ela já não está estornada.",
        ),
    });
  }
}
