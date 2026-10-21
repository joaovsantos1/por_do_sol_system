import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { environment } from "../../../environments/environment";

export interface AdjustStockDialogData {
  produtoId: string;
  produtoNome: string;
  estoqueAtual: number;
}

/// Balanço: define a quantidade REAL (contada) do produto. O servidor
/// calcula a diferença e registra um movimento de Ajuste com o motivo, então
/// o histórico de estoque continua completo.
@Component({
  selector: "app-adjust-stock-dialog",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Balanço — {{ data.produtoNome }}</h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <div mat-dialog-content class="conteudo">
        <p class="atual">
          Quantidade no sistema: <strong>{{ data.estoqueAtual }}</strong>
        </p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Quantidade contada (real)</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="1"
            formControlName="novaQuantidade"
            autofocus
          />
        </mat-form-field>

        @if (diferenca !== 0) {
          <p
            class="diferenca"
            [class.positivo]="diferenca > 0"
            [class.negativo]="diferenca < 0"
          >
            Diferença: {{ diferenca > 0 ? "+" : "" }}{{ diferenca }}
          </p>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Motivo</mat-label>
          <input matInput formControlName="motivo" />
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">
          Cancelar
        </button>
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="form.invalid || diferenca === 0"
        >
          Confirmar balanço
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .conteudo {
        display: flex;
        flex-direction: column;
        min-width: 300px;
      }
      .atual {
        color: #666;
        margin-top: 0;
      }
      .diferenca {
        font-weight: 600;
        margin: 0 0 12px;
      }
      .diferenca.positivo {
        color: var(--pdv-success);
      }
      .diferenca.negativo {
        color: var(--pdv-danger);
      }
    `,
  ],
})
export class AdjustStockDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public dialogRef: MatDialogRef<AdjustStockDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AdjustStockDialogData,
  ) {
    this.form = this.fb.group({
      novaQuantidade: [
        data.estoqueAtual,
        [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)],
      ],
      motivo: ["Balanço de estoque", Validators.required],
    });
  }

  get diferenca(): number {
    return (
      (Number(this.form.get("novaQuantidade")?.value) || 0) -
      this.data.estoqueAtual
    );
  }

  salvar(): void {
    if (this.form.invalid) return;
    const { novaQuantidade, motivo } = this.form.getRawValue();

    this.http
      .post(`${environment.apiUrl}/estoque/ajuste`, {
        produtoId: this.data.produtoId,
        novaQuantidade: Number(novaQuantidade),
        motivo,
      })
      .subscribe(() => this.dialogRef.close(true));
  }
}
