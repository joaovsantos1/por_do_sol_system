import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
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

export interface AddStockDialogData {
  produtoId: string;
  produtoNome: string;
  estoqueAtual: number;
}

/// Modal simples para dar ENTRADA de estoque em um produto já existente
/// (ex.: comprou mais Coca-Cola). Chama POST /api/estoque/entrada, que soma
/// a quantidade informada ao estoque atual e gera a movimentação — nunca
/// substitui o valor, sempre soma (estoqueAtual + quantidadeInformada).
@Component({
  selector: "app-add-stock-dialog",
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
    <h2 mat-dialog-title>Adicionar estoque — {{ data.produtoNome }}</h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <div mat-dialog-content class="conteudo">
        <p class="atual">
          Estoque atual: <strong>{{ data.estoqueAtual }}</strong>
        </p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Quantidade a adicionar</mat-label>
          <input
            matInput
            type="number"
            min="1"
            formControlName="quantidade"
            autofocus
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Observação (opcional)</mat-label>
          <input
            matInput
            formControlName="observacao"
            placeholder="Ex.: compra de reposição"
          />
        </mat-form-field>

        @if (form.get("quantidade")?.value > 0) {
          <p class="resultado">
            Novo estoque:
            <strong>{{
              data.estoqueAtual + (form.get("quantidade")?.value || 0)
            }}</strong>
          </p>
        }
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">
          Cancelar
        </button>
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="form.invalid"
        >
          Confirmar entrada
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
      .resultado {
        color: var(--pdv-primary);
        font-weight: 600;
      }
    `,
  ],
})
export class AddStockDialogComponent {
  form: ReturnType<FormBuilder["group"]>;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public dialogRef: MatDialogRef<AddStockDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddStockDialogData,
  ) {
    this.form = this.fb.group({
      quantidade: [0, [Validators.required, Validators.min(1)]],
      observacao: [""],
    });
  }

  salvar(): void {
    if (this.form.invalid) return;
    const { quantidade, observacao } = this.form.getRawValue();

    this.http
      .post(`${environment.apiUrl}/estoque/entrada`, {
        produtoId: this.data.produtoId,
        quantidade,
        observacao: observacao || undefined,
      })
      .subscribe(() => this.dialogRef.close(true));
  }
}
