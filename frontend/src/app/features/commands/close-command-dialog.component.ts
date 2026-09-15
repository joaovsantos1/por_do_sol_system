import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { PagamentoInput } from "../../core/services/comandas.service";

interface LinhaPagamento extends PagamentoInput {}

@Component({
  selector: "app-close-command-dialog",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Fechar comanda</h2>

    <div mat-dialog-content>
      <p class="total">
        TOTAL: <strong>R$ {{ data.total | number: "1.2-2" }}</strong>
      </p>

      @for (linha of pagamentos; track $index) {
        <div class="linha-pagamento">
          <mat-button-toggle-group [(ngModel)]="linha.forma">
            <mat-button-toggle value="Pix">PIX</mat-button-toggle>
            <mat-button-toggle value="Dinheiro">DINHEIRO</mat-button-toggle>
            <mat-button-toggle value="Cartao">CARTÃO</mat-button-toggle>
          </mat-button-toggle-group>

          <mat-form-field appearance="outline" class="valor-field">
            <mat-label>Valor</mat-label>
            <input
              matInput
              type="number"
              min="0"
              step="0.01"
              [(ngModel)]="linha.valor"
            />
          </mat-form-field>

          @if (pagamentos.length > 1) {
            <button mat-icon-button color="warn" (click)="removerLinha($index)">
              ✕
            </button>
          }
        </div>
      }

      <button mat-stroked-button (click)="adicionarLinha()">
        + Pagamento misto
      </button>

      <p class="somatorio" [class.insuficiente]="somaPagamentos < data.total">
        Pago: R$ {{ somaPagamentos | number: "1.2-2" }}

        @if (somaPagamentos < data.total) {
          <span>
            — faltam R$ {{ data.total - somaPagamentos | number: "1.2-2" }}
          </span>
        }
      </p>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>

      <button
        mat-flat-button
        color="primary"
        [disabled]="somaPagamentos < data.total"
        (click)="confirmar()"
      >
        Confirmar pagamento
      </button>
    </div>
  `,
  styles: [
    `
      .total {
        font-size: 1.1rem;
        margin-bottom: 12px;
      }

      .linha-pagamento {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .valor-field {
        width: 120px;
      }

      .somatorio {
        margin-top: 8px;
        font-weight: 600;
      }

      .somatorio.insuficiente {
        color: var(--pdv-danger);
      }
    `,
  ],
})
export class CloseCommandDialogComponent {
  pagamentos: LinhaPagamento[];

  constructor(
    public dialogRef: MatDialogRef<CloseCommandDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { total: number },
  ) {
    this.pagamentos = [
      {
        forma: "Pix",
        valor: data.total,
      },
    ];
  }

  get somaPagamentos(): number {
    return this.pagamentos.reduce(
      (soma, p) => soma + (Number(p.valor) || 0),
      0,
    );
  }

  adicionarLinha(): void {
    this.pagamentos.push({
      forma: "Dinheiro",
      valor: 0,
    });
  }

  removerLinha(index: number): void {
    this.pagamentos.splice(index, 1);
  }

  confirmar(): void {
    this.dialogRef.close(this.pagamentos);
  }
}
