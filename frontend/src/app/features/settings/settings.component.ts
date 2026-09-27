import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatSnackBar } from "@angular/material/snack-bar";

import { ConfiguracoesService } from "../../core/services/configuracoes.service";

/// Tela de configurações gerais — por ora só as taxas da maquininha de
/// cartão (crédito/débito), usadas para calcular automaticamente o valor
/// líquido de cada venda no cartão. Só Administrador tem acesso (ver
/// roleGuard na rota).
@Component({
  selector: "app-settings",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h1>Configurações</h1>

    <mat-card class="card">
      <h2>Taxas da maquininha de cartão</h2>
      <p class="explicacao">
        Sempre que uma comanda for fechada no crédito ou débito, o sistema
        desconta automaticamente essa taxa e guarda o valor líquido nos
        relatórios financeiros — é esse valor que deve bater com o extrato da
        maquininha.
      </p>

      <form [formGroup]="form" (ngSubmit)="salvar()">
        <div class="linha">
          <mat-form-field appearance="outline">
            <mat-label>Taxa cartão de crédito (%)</mat-label>
            <input
              matInput
              type="number"
              min="0"
              max="100"
              step="0.01"
              formControlName="taxaCartaoCreditoPercentual"
            />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Taxa cartão de débito (%)</mat-label>
            <input
              matInput
              type="number"
              min="0"
              max="100"
              step="0.01"
              formControlName="taxaCartaoDebitoPercentual"
            />
          </mat-form-field>
        </div>

        @if (form.get("taxaCartaoCreditoPercentual")?.value > 0) {
          <p class="exemplo">
            Exemplo: uma venda de R$ 100,00 no crédito viraria
            <strong
              >R$
              {{
                100 - form.get("taxaCartaoCreditoPercentual")!.value
                  | number: "1.2-2"
              }}</strong
            >
            líquidos.
          </p>
        }

        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="form.invalid || salvando"
        >
          Salvar
        </button>
      </form>
    </mat-card>
  `,
  styles: [
    `
      .card {
        max-width: 480px;
        padding: 20px;
      }
      .explicacao {
        color: #666;
        font-size: 0.85rem;
      }
      .linha {
        display: flex;
        gap: 12px;
      }
      .linha mat-form-field {
        flex: 1;
      }
      .exemplo {
        font-size: 0.85rem;
        color: var(--pdv-primary);
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  form: ReturnType<FormBuilder["group"]>;
  salvando = false;

  constructor(
    private fb: FormBuilder,
    private configuracoesService: ConfiguracoesService,
    private snack: MatSnackBar,
  ) {
    this.form = this.fb.group({
      taxaCartaoCreditoPercentual: [
        0,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
      taxaCartaoDebitoPercentual: [
        0,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
    });
  }

  ngOnInit(): void {
    this.configuracoesService
      .obterTaxas()
      .subscribe((taxas) => this.form.patchValue(taxas));
  }

  salvar(): void {
    if (this.form.invalid) return;
    this.salvando = true;

    this.configuracoesService
      .atualizarTaxas(this.form.getRawValue() as any)
      .subscribe({
        next: () => {
          this.salvando = false;
          this.snack.open("Taxas atualizadas com sucesso!", "OK", {
            duration: 3000,
          });
        },
        error: () => {
          this.salvando = false;
        },
      });
  }
}
