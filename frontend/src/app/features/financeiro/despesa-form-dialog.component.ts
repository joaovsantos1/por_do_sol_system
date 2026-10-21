import { Component, Inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
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
import { MatIconModule } from "@angular/material/icon";
import { Observable } from "rxjs";

import {
  CategoriasDespesaService,
  DespesasService,
  Despesa,
  CategoriaDespesa,
} from "../../core/services/financeiro.service";

export interface DespesaFormDialogData {
  despesa?: Despesa;
}

@Component({
  selector: "app-despesa-form-dialog",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data?.despesa ? "Editar despesa" : "Nova despesa" }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <div mat-dialog-content class="conteudo">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descrição</mat-label>
          <input
            matInput
            formControlName="descricao"
            placeholder="Ex.: Conta de luz"
          />
        </mat-form-field>

        <div class="linha">
          <mat-form-field appearance="outline" class="categoria-field">
            <mat-label>Categoria</mat-label>
            <mat-select formControlName="categoriaDespesaId">
              @for (categoria of categorias; track categoria.id) {
                <mat-option [value]="categoria.id">{{
                  categoria.nome
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button
            mat-icon-button
            type="button"
            (click)="mostrarNovaCategoria = !mostrarNovaCategoria"
            title="Nova categoria"
          >
            <mat-icon>add_circle</mat-icon>
          </button>
        </div>

        @if (mostrarNovaCategoria) {
          <div class="linha">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nome da categoria nova</mat-label>
              <input
                matInput
                [(ngModel)]="novaCategoriaNome"
                [ngModelOptions]="{ standalone: true }"
              />
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="criarCategoria()">
              Criar
            </button>
          </div>
        }

        <div class="linha">
          <mat-form-field appearance="outline">
            <mat-label>Valor (R$)</mat-label>
            <input
              matInput
              type="number"
              min="0"
              step="0.01"
              formControlName="valor"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Data</mat-label>
            <input matInput type="date" formControlName="data" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Observação (opcional)</mat-label>
          <input matInput formControlName="observacao" />
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
        min-width: 360px;
      }
      .linha {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .linha mat-form-field {
        flex: 1;
      }
      .categoria-field {
        flex: 1;
      }
    `,
  ],
})
export class DespesaFormDialogComponent implements OnInit {
  categorias: CategoriaDespesa[] = [];
  mostrarNovaCategoria = false;
  novaCategoriaNome = "";
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private despesasService: DespesasService,
    private categoriasService: CategoriasDespesaService,
    public dialogRef: MatDialogRef<DespesaFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DespesaFormDialogData | null,
  ) {
    const despesa = this.data?.despesa;

    this.form = this.fb.group({
      descricao: [despesa?.descricao ?? "", Validators.required],
      categoriaDespesaId: [
        despesa?.categoriaDespesaId ?? "",
        Validators.required,
      ],
      valor: [despesa?.valor ?? 0, [Validators.required, Validators.min(0.01)]],
      data: [
        despesa
          ? despesa.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        Validators.required,
      ],
      observacao: [despesa?.observacao ?? ""],
    });
  }

  ngOnInit(): void {
    this.categoriasService.listar().subscribe((c) => (this.categorias = c));
  }

  criarCategoria(): void {
    const nome = this.novaCategoriaNome.trim();
    if (!nome) return;

    this.categoriasService.criar(nome).subscribe(({ id }) => {
      this.categoriasService.listar().subscribe((cats) => {
        this.categorias = cats;
        this.form.patchValue({ categoriaDespesaId: id });
      });
      this.novaCategoriaNome = "";
      this.mostrarNovaCategoria = false;
    });
  }

  salvar(): void {
    if (this.form.invalid) return;
    const valores = this.form.getRawValue();

    const request$: Observable<unknown> = this.data?.despesa
      ? this.despesasService.editar(this.data.despesa.id, valores)
      : this.despesasService.criar(valores);

    request$.subscribe(() => this.dialogRef.close(true));
  }
}
