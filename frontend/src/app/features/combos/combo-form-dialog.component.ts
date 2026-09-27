import { Component, Inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  FormArray,
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

import { CombosService, Combo } from "../../core/services/combos.service";
import { ProdutosService, Produto } from "../../core/services/produtos.service";
import { map } from "rxjs";

export interface ComboFormDialogData {
  combo?: Combo;
}

@Component({
  selector: "app-combo-form-dialog",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data?.combo ? "Editar combo" : "Novo combo" }}</h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <div mat-dialog-content class="conteudo">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome do combo</mat-label>
          <input
            matInput
            formControlName="nome"
            placeholder="Ex.: Salgado + Refri"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descrição (opcional)</mat-label>
          <input matInput formControlName="descricao" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Preço do combo (R$)</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="0.01"
            formControlName="precoVenda"
          />
        </mat-form-field>

        <h3>Produtos do combo</h3>
        <div formArrayName="itens">
          @for (item of itens.controls; track $index; let i = $index) {
            <div class="linha-item" [formGroupName]="i">
              <mat-form-field appearance="outline" class="produto-field">
                <mat-label>Produto</mat-label>
                <mat-select formControlName="produtoId">
                  @for (produto of produtos; track produto.id) {
                    <mat-option [value]="produto.id">{{
                      produto.nome
                    }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="qtd-field">
                <mat-label>Qtd.</mat-label>
                <input
                  matInput
                  type="number"
                  min="1"
                  formControlName="quantidade"
                />
              </mat-form-field>
              <button
                mat-icon-button
                type="button"
                color="warn"
                (click)="removerItem(i)"
                [disabled]="itens.length <= 1"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>
        <button mat-stroked-button type="button" (click)="adicionarItem()">
          + Adicionar produto
        </button>

        @if (precoAvulsoTotal > 0) {
          <p class="comparativo">
            Preço avulso somado: R$ {{ precoAvulsoTotal | number: "1.2-2" }} —
            @if (form.get("precoVenda")?.value < precoAvulsoTotal) {
              <span class="economia"
                >economia de R$
                {{
                  precoAvulsoTotal - form.get("precoVenda")!.value
                    | number: "1.2-2"
                }}</span
              >
            } @else {
              <span class="alerta"
                >preço do combo não está mais barato que comprar avulso!</span
              >
            }
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
        min-width: 380px;
      }
      h3 {
        margin: 8px 0 4px;
        font-size: 0.9rem;
        color: #555;
      }
      .linha-item {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .produto-field {
        flex: 1;
      }
      .qtd-field {
        width: 80px;
      }
      .comparativo {
        font-size: 0.85rem;
        margin-top: 8px;
      }
      .economia {
        color: var(--pdv-success);
        font-weight: 600;
      }
      .alerta {
        color: var(--pdv-danger);
        font-weight: 600;
      }
    `,
  ],
})
export class ComboFormDialogComponent implements OnInit {
  produtos: Produto[] = [];
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private combosService: CombosService,
    private produtosService: ProdutosService,
    public dialogRef: MatDialogRef<ComboFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ComboFormDialogData | null,
  ) {
    const combo = this.data?.combo;

    this.form = this.fb.group({
      nome: [combo?.nome ?? "", Validators.required],
      descricao: [combo?.descricao ?? ""],
      precoVenda: [
        combo?.precoVenda ?? 0,
        [Validators.required, Validators.min(0.01)],
      ],
      itens: this.fb.array(
        combo?.itens.length
          ? combo.itens.map((i) =>
              this.criarLinhaItem(i.produtoId, i.quantidade),
            )
          : [this.criarLinhaItem()],
      ),
    });
  }

  ngOnInit(): void {
    this.produtosService.listar().subscribe((p) => (this.produtos = p));
  }

  get itens(): FormArray {
    return this.form.get("itens") as FormArray;
  }

  private criarLinhaItem(produtoId = "", quantidade = 1): FormGroup {
    return this.fb.group({
      produtoId: [produtoId, Validators.required],
      quantidade: [quantidade, [Validators.required, Validators.min(1)]],
    });
  }

  adicionarItem(): void {
    this.itens.push(this.criarLinhaItem());
  }

  removerItem(index: number): void {
    if (this.itens.length > 1) this.itens.removeAt(index);
  }

  get precoAvulsoTotal(): number {
    return this.itens.controls.reduce((soma, ctrl) => {
      const { produtoId, quantidade } = ctrl.value;
      const produto = this.produtos.find((p) => p.id === produtoId);
      return soma + (produto ? produto.precoVenda * (quantidade || 0) : 0);
    }, 0);
  }

  salvar(): void {
    if (this.form.invalid) return;
    const valores = this.form.getRawValue();

    const request$ = this.data?.combo
      ? this.combosService
          .editar(this.data.combo.id, valores)
          .pipe(map(() => void 0))
      : this.combosService.criar(valores).pipe(map(() => void 0));

    request$.subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => {
        console.error("Erro ao salvar combo:", err);
      },
    });
  }
}
