import { Component, Inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
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
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import {
  CategoriasService,
  Categoria,
} from "../../core/services/produtos.service";

export interface ProductFormDialogData {
  produto?: {
    id: string;
    codigo: string;
    codigoBarras?: string;
    nome: string;
    descricao?: string;
    categoriaId: string;
    precoVenda: number;
    precoCusto: number;
    estoqueMinimo: number;
    unidade: string;
  };
}

@Component({
  selector: "app-product-form-dialog",
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
      {{ data?.produto ? "Editar produto" : "Novo produto" }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <div mat-dialog-content class="conteudo">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="nome" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Código interno</mat-label>
          <input matInput formControlName="codigo" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Código de barras (opcional)</mat-label>
          <input matInput formControlName="codigoBarras" />
        </mat-form-field>

        <div class="linha-categoria">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Categoria</mat-label>
            <mat-select formControlName="categoriaId">
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
            title="Cadastrar nova categoria"
          >
            <mat-icon>add_circle_outline</mat-icon>
          </button>
        </div>
        @if (mostrarNovaCategoria) {
          <div class="nova-categoria">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nome da nova categoria</mat-label>
              <input
                matInput
                [(ngModel)]="novaCategoriaNome"
                [ngModelOptions]="{ standalone: true }"
                (keyup.enter)="criarCategoria()"
              />
            </mat-form-field>
            <button
              mat-flat-button
              color="primary"
              type="button"
              [disabled]="!novaCategoriaNome.trim()"
              (click)="criarCategoria()"
            >
              Adicionar
            </button>
          </div>
        }

        <div class="linha">
          <mat-form-field appearance="outline">
            <mat-label>Preço de venda</mat-label>
            <input
              matInput
              type="number"
              min="0"
              step="0.01"
              formControlName="precoVenda"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Preço de custo</mat-label>
            <input
              matInput
              type="number"
              min="0"
              step="0.01"
              formControlName="precoCusto"
            />
          </mat-form-field>
        </div>

        <div class="linha">
          @if (!data?.produto) {
            <mat-form-field appearance="outline">
              <mat-label>Estoque Atual</mat-label>
              <input
                matInput
                type="number"
                min="0"
                formControlName="estoqueInicial"
              />
            </mat-form-field>
          }

          <mat-form-field appearance="outline">
            <mat-label>Estoque mínimo</mat-label>
            <input
              matInput
              type="number"
              min="0"
              formControlName="estoqueMinimo"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Unidade</mat-label>
            <input matInput formControlName="unidade" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descrição (opcional)</mat-label>
          <textarea matInput formControlName="descricao" rows="2"></textarea>
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
        min-width: 340px;
      }
      .linha {
        display: flex;
        gap: 8px;
      }
      .linha mat-form-field {
        flex: 1;
      }
      .linha-categoria {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .nova-categoria {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-top: -8px;
        margin-bottom: 8px;
      }
      .aviso {
        font-size: 0.8rem;
        color: #777;
        background: #f4f6f8;
        padding: 8px;
        border-radius: 6px;
      }
    `,
  ],
})
export class ProductFormDialogComponent implements OnInit {
  categorias: Categoria[] = [];
  mostrarNovaCategoria = false;
  novaCategoriaNome = "";

  form: ReturnType<FormBuilder["group"]>;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private categoriasService: CategoriasService,
    public dialogRef: MatDialogRef<ProductFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProductFormDialogData | null,
  ) {
    this.form = this.fb.group({
      nome: ["", Validators.required],
      codigo: ["", Validators.required],
      codigoBarras: [""],
      categoriaId: ["", Validators.required],
      precoVenda: [0, [Validators.required, Validators.min(0)]],
      precoCusto: [0, [Validators.required, Validators.min(0)]],
      estoqueInicial: [0, [Validators.min(0)]],
      estoqueMinimo: [0, [Validators.required, Validators.min(0)]],
      unidade: ["UN", Validators.required],
      descricao: [""],
    });
  }

  ngOnInit(): void {
    this.categoriasService
      .listar()
      .subscribe((cats) => (this.categorias = cats));

    if (this.data?.produto) {
      this.form.patchValue(this.data.produto);
    }
  }

  criarCategoria(): void {
    const nome = this.novaCategoriaNome.trim();
    if (!nome) return;

    this.categoriasService.criar(nome).subscribe(({ id }) => {
      this.categoriasService.listar().subscribe((cats) => {
        this.categorias = cats;
        this.form.patchValue({ categoriaId: id });
      });
      this.novaCategoriaNome = "";
      this.mostrarNovaCategoria = false;
    });
  }

  salvar(): void {
    if (this.form.invalid) return;
    const payload = this.form.getRawValue();
    const base = `${environment.apiUrl}/produtos`;

    const request$ = this.data?.produto
      ? this.http.put(`${base}/${this.data.produto.id}`, payload)
      : this.http.post(base, payload);

    request$.subscribe(() => this.dialogRef.close(true));
  }
}
