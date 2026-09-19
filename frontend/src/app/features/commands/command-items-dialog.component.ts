import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { ComandaHistorico } from "../../core/services/comandas.service";

@Component({
  selector: "app-command-items-dialog",
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>
      Comanda #{{ data.numero }}
      @if (data.numeroMesa) {
        — Mesa {{ data.numeroMesa }}
      }
      @if (data.nomeCliente) {
        — {{ data.nomeCliente }}
      }
    </h2>
    <div mat-dialog-content>
      <div class="item-row" *ngFor="let item of data.itens">
        <span class="item-nome"
          >{{ item.quantidade }}x {{ item.produtoNome }}</span
        >
        <span class="item-subtotal"
          >R$ {{ item.subtotal | number: "1.2-2" }}</span
        >
      </div>
      @if (data.itens.length === 0) {
        <p class="vazio">Essa comanda não tem itens registrados.</p>
      }
      <div class="total-row">
        <span>TOTAL</span>
        <span>R$ {{ data.valorTotal | number: "1.2-2" }}</span>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fechar</button>
    </div>
  `,
  styles: [
    `
      .item-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid #eee;
        min-width: 280px;
      }
      .item-nome {
        font-size: 0.9rem;
      }
      .item-subtotal {
        font-size: 0.9rem;
        font-weight: 600;
      }
      .vazio {
        color: #999;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
        padding-top: 10px;
        margin-top: 6px;
        border-top: 2px solid #ddd;
      }
    `,
  ],
})
export class CommandItemsDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ComandaHistorico) {}
}
