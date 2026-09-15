import { Component, Inject, Optional } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { Observable } from "rxjs";
import { MetasService, Meta } from "../../core/services/dashboard.service";

export interface NewGoalDialogData {
  meta?: Meta;
}

@Component({
  selector: "app-new-goal-dialog",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data?.meta ? "Editar meta" : "Nova meta" }}</h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <div mat-dialog-content class="conteudo">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo">
            <mat-option value="Diaria">Diária</mat-option>
            <mat-option value="Semanal">Semanal</mat-option>
            <mat-option value="Mensal">Mensal</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descrição (opcional)</mat-label>
          <input matInput formControlName="descricao" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Início do período</mat-label>
          <input matInput type="date" formControlName="periodoInicio" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Fim do período</mat-label>
          <input matInput type="date" formControlName="periodoFim" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Valor alvo (R$)</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="0.01"
            formControlName="valorAlvo"
          />
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
          [disabled]="form.invalid"
        >
          Salvar
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
      }
    `,
  ],
})
export class NewGoalDialogComponent {
  form: ReturnType<FormBuilder["group"]>;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<NewGoalDialogComponent>,
    private metasService: MetasService,
    @Optional()
    @Inject(MAT_DIALOG_DATA)
    public data: NewGoalDialogData | null,
  ) {
    const meta = this.data?.meta;

    this.form = this.fb.group({
      tipo: [meta?.tipo ?? "Mensal", Validators.required],
      descricao: [meta?.descricao ?? ""],
      periodoInicio: [
        meta ? meta.periodoInicio.slice(0, 10) : "",
        Validators.required,
      ],
      periodoFim: [
        meta ? meta.periodoFim.slice(0, 10) : "",
        Validators.required,
      ],
      valorAlvo: [
        meta?.valorAlvo ?? 0,
        [Validators.required, Validators.min(0.01)],
      ],
    });
  }

  salvar(): void {
    if (this.form.invalid) return;
    const valores = this.form.getRawValue();

    const payload = {
      tipo: valores.tipo!,
      descricao: valores.descricao || undefined,
      periodoInicio: new Date(valores.periodoInicio!).toISOString(),
      periodoFim: new Date(valores.periodoFim!).toISOString(),
      valorAlvo: Number(valores.valorAlvo),
    };

    const request$: Observable<unknown> = this.data?.meta
      ? this.metasService.editar(this.data.meta.id, payload)
      : this.metasService.criar(payload);

    request$.subscribe(() => this.dialogRef.close(true));
    // this.metasService
    //   .criar({
    //     tipo: valores.tipo!,
    //     descricao: valores.descricao || undefined,
    //     periodoInicio: new Date(valores.periodoInicio!).toISOString(),
    //     periodoFim: new Date(valores.periodoFim!).toISOString(),
    //     valorAlvo: Number(valores.valorAlvo),
    //   })
    //   .subscribe(() => this.dialogRef.close(true));
  }
}
