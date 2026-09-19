import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";

export interface NewCommandDialogResult {
  numeroMesa?: number;
  nomeCliente?: string;
}

/// Mesa e nome do cliente são OPCIONAIS — a comanda sempre tem um número
/// sequencial próprio independente disso; esses dois campos são só uma
/// forma extra de identificar visualmente a comanda nas listagens (útil
/// quando o local tem mesas numeradas, ou quando é mais fácil lembrar
/// "a comanda da Maria" do que "a comanda 152").
@Component({
  selector: "app-new-command-dialog",
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
    <h2 mat-dialog-title>Nova comanda</h2>
    <form [formGroup]="form" (ngSubmit)="confirmar()">
      <div mat-dialog-content class="conteudo">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Número da mesa (opcional)</mat-label>
          <input
            matInput
            type="number"
            min="1"
            formControlName="numeroMesa"
            autofocus
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome do cliente (opcional)</mat-label>
          <input matInput formControlName="nomeCliente" />
        </mat-form-field>

        <p class="dica">
          Deixe os dois em branco pra abrir só com o número sequencial normal.
        </p>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">
          Cancelar
        </button>
        <button mat-flat-button color="primary" type="submit">
          Abrir comanda
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
      .dica {
        font-size: 0.8rem;
        color: #888;
        margin: 0;
      }
    `,
  ],
})
export class NewCommandDialogComponent {
  form: ReturnType<FormBuilder["group"]>;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<NewCommandDialogComponent>,
  ) {
    this.form = this.fb.group({
      numeroMesa: [null as number | null],
      nomeCliente: [""],
    });
  }

  confirmar(): void {
    const valores = this.form.getRawValue();
    const resultado: NewCommandDialogResult = {
      numeroMesa: valores.numeroMesa ?? undefined,
      nomeCliente: valores.nomeCliente?.trim() || undefined,
    };
    this.dialogRef.close(resultado);
  }
}
