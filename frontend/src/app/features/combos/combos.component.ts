import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatChipsModule } from "@angular/material/chips";

import { CombosService, Combo } from "../../core/services/combos.service";
import { ComboFormDialogComponent } from "./combo-form-dialog.component";

@Component({
  selector: "app-combos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
  ],
  template: `
    <div class="header">
      <h1>Combos / Kits</h1>
      <button mat-flat-button color="primary" (click)="novoCombo()">
        <mat-icon>add</mat-icon> Novo combo
      </button>
    </div>

    <div class="grid">
      @for (combo of combos; track combo.id) {
        <mat-card class="card" [class.inativo]="!combo.ativo">
          <div class="card-header">
            <h3>{{ combo.nome }}</h3>
            <mat-chip [color]="combo.ativo ? undefined : 'warn'" selected>{{
              combo.ativo ? "Ativo" : "Inativo"
            }}</mat-chip>
          </div>
          @if (combo.descricao) {
            <p class="descricao">{{ combo.descricao }}</p>
          }

          <ul class="itens-lista">
            @for (item of combo.itens; track item.produtoId) {
              <li>{{ item.quantidade }}x {{ item.produtoNome }}</li>
            }
          </ul>

          <div class="precos">
            <span class="preco-combo"
              >R$ {{ combo.precoVenda | number: "1.2-2" }}</span
            >
            @if (combo.precoAvulsoReferencia > combo.precoVenda) {
              <span class="preco-avulso"
                >de R$ {{ combo.precoAvulsoReferencia | number: "1.2-2" }}</span
              >
            }
          </div>

          <div class="acoes">
            <button mat-icon-button (click)="editar(combo)" title="Editar">
              <mat-icon>edit</mat-icon>
            </button>
            <button
              mat-icon-button
              (click)="alternarAtivo(combo)"
              [title]="combo.ativo ? 'Inativar' : 'Ativar'"
            >
              <mat-icon>{{
                combo.ativo ? "visibility_off" : "visibility"
              }}</mat-icon>
            </button>
          </div>
        </mat-card>
      } @empty {
        <p class="vazio">Nenhum combo cadastrado ainda.</p>
      }
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }
      .card {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .card.inativo {
        opacity: 0.6;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .card-header h3 {
        margin: 0;
      }
      .descricao {
        color: #777;
        font-size: 0.85rem;
        margin: 0;
      }
      .itens-lista {
        margin: 4px 0;
        padding-left: 18px;
        font-size: 0.85rem;
        color: #555;
      }
      .precos {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .preco-combo {
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--pdv-primary);
      }
      .preco-avulso {
        font-size: 0.8rem;
        color: #999;
        text-decoration: line-through;
      }
      .acoes {
        margin-top: 4px;
      }
      .vazio {
        color: #999;
      }
    `,
  ],
})
export class CombosComponent implements OnInit {
  combos: Combo[] = [];

  constructor(
    private combosService: CombosService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.combosService.listar(false).subscribe((c) => (this.combos = c));
  }

  novoCombo(): void {
    const ref = this.dialog.open(ComboFormDialogComponent, { width: "460px" });
    ref.afterClosed().subscribe((salvo) => {
      if (salvo) this.carregar();
    });
  }

  editar(combo: Combo): void {
    const ref = this.dialog.open(ComboFormDialogComponent, {
      width: "460px",
      data: { combo },
    });
    ref.afterClosed().subscribe((salvo) => {
      if (salvo) this.carregar();
    });
  }

  alternarAtivo(combo: Combo): void {
    this.combosService
      .alternarAtivo(combo.id, !combo.ativo)
      .subscribe(() => this.carregar());
  }
}
