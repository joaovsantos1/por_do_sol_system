import { Component, Inject, OnInit } from "@angular/core";
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
import {
  ConfiguracoesService,
  TaxasCartao,
} from "../../core/services/configuracoes.service";

interface LinhaPagamento extends PagamentoInput {
  /// Só usado na tela para DINHEIRO — quanto o cliente entregou de fato.
  /// Nunca é enviado ao backend; "valor" continua sendo o quanto foi
  /// efetivamente aplicado ao total (pra não distorcer relatórios de
  /// faturamento por forma de pagamento com o troco).
  recebido?: number;
}

/// Fechamento de comanda com desconto opcional, troco calculado ao vivo pra
/// pagamento em dinheiro (estilo caixa de supermercado), e crédito/débito
/// separados — cada um mostra ao vivo quanto vai sobrar líquido depois da
/// taxa da maquininha (o cálculo real e definitivo acontece no backend no
/// momento do fechamento; aqui é só uma prévia pro operador).
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
      <div class="resumo">
        <div class="linha-resumo">
          <span>Subtotal</span>
          <span>R$ {{ data.total | number: "1.2-2" }}</span>
        </div>
        <div class="linha-resumo desconto-linha">
          <span>Desconto</span>
          <mat-form-field appearance="outline" class="desconto-field">
            <input
              matInput
              type="number"
              min="0"
              [max]="data.total"
              step="0.01"
              [(ngModel)]="desconto"
              (ngModelChange)="onDescontoChange()"
            />
          </mat-form-field>
        </div>
        <div class="linha-resumo total-a-pagar">
          <span>TOTAL A PAGAR</span>
          <span>R$ {{ totalAPagar | number: "1.2-2" }}</span>
        </div>
      </div>

      @for (linha of pagamentos; track $index) {
        <div class="linha-pagamento">
          <mat-button-toggle-group
            [(ngModel)]="linha.forma"
            class="toggle-group"
          >
            <mat-button-toggle value="Pix">PIX</mat-button-toggle>
            <mat-button-toggle value="Dinheiro">DINHEIRO</mat-button-toggle>
            <mat-button-toggle value="CartaoCredito">CRÉDITO</mat-button-toggle>
            <mat-button-toggle value="CartaoDebito">DÉBITO</mat-button-toggle>
          </mat-button-toggle-group>

          <mat-form-field appearance="outline" class="valor-field">
            <mat-label>{{
              linha.forma === "Dinheiro" ? "Valor a aplicar" : "Valor"
            }}</mat-label>
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

        @if (linha.forma === "Dinheiro") {
          <div class="linha-extra">
            <mat-form-field appearance="outline" class="extra-field">
              <mat-label>Valor Recebido</mat-label>
              <input
                matInput
                type="number"
                min="0"
                step="0.01"
                [(ngModel)]="linha.recebido"
              />
            </mat-form-field>
            @if ((linha.recebido || 0) > linha.valor) {
              <span class="troco"
                >Troco: R$
                {{
                  (linha.recebido || 0) - linha.valor | number: "1.2-2"
                }}</span
              >
            }
          </div>
        }

        @if (
          linha.forma === "CartaoCredito" || linha.forma === "CartaoDebito"
        ) {
          <div class="linha-extra">
            <span class="liquido">
              Líquido após taxa ({{ taxaAtual(linha.forma) }}%):
              <strong>R$ {{ valorLiquido(linha) | number: "1.2-2" }}</strong>
            </span>
          </div>
        }
      }

      <button mat-stroked-button (click)="adicionarLinha()">
        + Pagamento misto
      </button>

      <p class="somatorio" [class.insuficiente]="somaPagamentos < totalAPagar">
        Pago: R$ {{ somaPagamentos | number: "1.2-2" }}
        @if (somaPagamentos < totalAPagar) {
          <span>
            — faltam R$
            {{ totalAPagar - somaPagamentos | number: "1.2-2" }}</span
          >
        }
      </p>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="somaPagamentos < totalAPagar"
        (click)="confirmar()"
      >
        Confirmar pagamento
      </button>
    </div>
  `,
  styles: [
    `
      .resumo {
        margin-bottom: 12px;
      }
      .linha-resumo {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
      }
      .desconto-linha .desconto-field {
        width: 110px;
      }
      .desconto-linha .desconto-field ::ng-deep .mat-mdc-form-field-infix {
        min-height: 40px;
        padding-top: 8px;
      }
      .total-a-pagar {
        font-size: 1.15rem;
        font-weight: 700;
        border-top: 1px solid #ddd;
        padding-top: 8px;
        margin-top: 4px;
      }

      .linha-pagamento {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .toggle-group {
        flex-shrink: 0;
      }
      .toggle-group ::ng-deep .mat-button-toggle-label-content {
        padding: 0 6px;
        font-size: 0.72rem;
      }
      .valor-field {
        width: 130px;
      }

      .linha-extra {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0 0 10px 4px;
      }
      .extra-field {
        width: 160px;
      }
      .troco {
        color: var(--pdv-success);
        font-weight: 700;
        font-size: 1rem;
      }
      .liquido {
        color: var(--pdv-primary);
        font-size: 0.9rem;
      }

      .somatorio {
        margin-top: 8px;
        font-weight: 600;
      }
      .somatorio.insuficiente {
        color: var(--pdv-danger);
      }

      @media (max-width: 460px) {
        .toggle-group {
          width: 100%;
        }
        .toggle-group mat-button-toggle {
          flex: 1;
        }
      }
    `,
  ],
})
export class CloseCommandDialogComponent implements OnInit {
  pagamentos: LinhaPagamento[] = [];
  desconto = 0;
  taxas: TaxasCartao = {
    taxaCartaoCreditoPercentual: 0,
    taxaCartaoDebitoPercentual: 0,
    taxaServicoAtiva: false,
    taxaServicoPercentual: 10,
  };

  constructor(
    public dialogRef: MatDialogRef<CloseCommandDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { total: number },
    private configuracoesService: ConfiguracoesService,
  ) {
    this.pagamentos = [{ forma: "Pix", valor: data.total }];
  }

  ngOnInit(): void {
    // Só pra mostrar a prévia do valor líquido na tela — o cálculo real e
    // definitivo é sempre feito no backend no momento do fechamento, com a
    // taxa vigente naquele instante.
    this.configuracoesService.obterTaxas().subscribe((t) => (this.taxas = t));
  }

  get totalAPagar(): number {
    return Math.max(0, this.data.total - (Number(this.desconto) || 0));
  }

  get somaPagamentos(): number {
    return this.pagamentos.reduce(
      (soma, p) => soma + (Number(p.valor) || 0),
      0,
    );
  }

  taxaAtual(forma: "CartaoCredito" | "CartaoDebito"): number {
    return forma === "CartaoCredito"
      ? this.taxas.taxaCartaoCreditoPercentual
      : this.taxas.taxaCartaoDebitoPercentual;
  }

  valorLiquido(linha: LinhaPagamento): number {
    const taxa = this.taxaAtual(
      linha.forma as "CartaoCredito" | "CartaoDebito",
    );
    return (Number(linha.valor) || 0) * (1 - taxa / 100);
  }

  /// Quando só existe uma forma de pagamento (o caso mais comum), ajusta o
  /// valor dela automaticamente pro total já com desconto — sem isso, o
  /// operador tinha que editar esse campo manualmente toda vez.
  onDescontoChange(): void {
    if (this.pagamentos.length === 1) {
      this.pagamentos[0].valor = this.totalAPagar;
    }
  }

  adicionarLinha(): void {
    this.pagamentos.push({ forma: "Dinheiro", valor: 0 });
  }

  removerLinha(index: number): void {
    this.pagamentos.splice(index, 1);
  }

  confirmar(): void {
    // Nunca envia o campo "recebido" ao backend — só o valor aplicado.
    // O valor líquido também não é enviado — o backend recalcula sozinho
    // com a taxa vigente no momento do fechamento (fonte da verdade).
    const pagamentos: PagamentoInput[] = this.pagamentos.map(
      ({ forma, valor }) => ({ forma, valor }),
    );
    this.dialogRef.close({ pagamentos, desconto: Number(this.desconto) || 0 });
  }
}
