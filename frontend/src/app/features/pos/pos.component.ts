import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Subscription, debounceTime, Subject } from "rxjs";

import { ComandasService, Comanda } from "../../core/services/comandas.service";
import { ProdutosService, Produto } from "../../core/services/produtos.service";
import { RealtimeService } from "../../core/services/realtime.service";
import { CloseCommandDialogComponent } from "../commands/close-command-dialog.component";
import {
  NewCommandDialogComponent,
  NewCommandDialogResult,
} from "./new-command-dialog.component";
import { ScannerButtonComponent } from "../../shared/scanner-button.component";

@Component({
  selector: "app-pos",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    ScannerButtonComponent,
  ],
  template: `
    <div class="pos-layout">
      <!-- Busca/abertura de comanda por número, scanner USB (teclado) ou digitação -->
      <div class="comanda-bar">
        <mat-form-field appearance="outline" class="comanda-input">
          <mat-label>Digite ou escaneie a comanda</mat-label>
          <input
            matInput
            #comandaInput
            [(ngModel)]="codigoDigitado"
            (keyup.enter)="buscarComanda(codigoDigitado)"
            autofocus
          />
        </mat-form-field>
        <button
          mat-flat-button
          color="primary"
          (click)="buscarComanda(codigoDigitado)"
        >
          <mat-icon>search</mat-icon> <span>Buscar</span>
        </button>
        <button mat-stroked-button (click)="abrirNovaComanda()">
          <mat-icon>add</mat-icon> <span>Nova comanda</span>
        </button>
        <app-scanner-button (lido)="buscarComanda($event)"></app-scanner-button>
      </div>

      @if (!comandaAtual) {
        <div class="empty-state">
          <mat-icon>receipt_long</mat-icon>
          <p>
            Nenhuma comanda selecionada. Digite/escaneie um número ou abra uma
            nova comanda.
          </p>
        </div>
      } @else {
        <div class="pos-grid">
          <!-- Coluna de produtos -->
          <div class="produtos-col">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Buscar produto (nome ou código de barras)</mat-label>
              <input
                matInput
                [(ngModel)]="termoBusca"
                (ngModelChange)="buscaSubject.next($event)"
              />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <div class="produtos-grid">
              @for (produto of produtos; track produto.id) {
                <button
                  class="produto-card"
                  [class.sem-estoque]="produto.estoqueAtual <= 0"
                  [disabled]="produto.estoqueAtual <= 0"
                  (click)="adicionarProduto(produto)"
                >
                  <span class="nome">{{ produto.nome }}</span>
                  <span class="preco"
                    >R$ {{ produto.precoVenda | number: "1.2-2" }}</span
                  >
                  <span class="estoque" [class.baixo]="produto.estoqueBaixo">
                    Estoque: {{ produto.estoqueAtual }}
                  </span>
                </button>
              }
            </div>
          </div>

          <!-- Coluna da comanda atual -->
          <mat-card class="comanda-col">
            <div class="comanda-col-header">
              <h2>Comanda #{{ comandaAtual.numero }}</h2>
              <button
                mat-icon-button
                (click)="voltarInicio()"
                title="Voltar ao início (a comanda continua aberta)"
              >
                <mat-icon>arrow_back</mat-icon>
              </button>
            </div>
            <p class="operador">Aberta por {{ comandaAtual.abertaPor }}</p>
            @if (comandaAtual.numeroMesa || comandaAtual.nomeCliente) {
              <p class="identificacao">
                @if (comandaAtual.numeroMesa) {
                  <span>Mesa {{ comandaAtual.numeroMesa }}</span>
                }
                @if (comandaAtual.numeroMesa && comandaAtual.nomeCliente) {
                  <span> · </span>
                }
                @if (comandaAtual.nomeCliente) {
                  <span>{{ comandaAtual.nomeCliente }}</span>
                }
              </p>
            }

            <div class="itens-lista">
              @for (item of comandaAtual.itens; track item.id) {
                <div class="item-row">
                  <span class="item-nome">{{ item.produtoNome }}</span>
                  <div class="item-qtd">
                    <button
                      mat-icon-button
                      (click)="alterarQuantidade(item, item.quantidade - 1)"
                    >
                      <mat-icon>remove</mat-icon>
                    </button>
                    <span>{{ item.quantidade }}</span>
                    <button
                      mat-icon-button
                      (click)="alterarQuantidade(item, item.quantidade + 1)"
                    >
                      <mat-icon>add</mat-icon>
                    </button>
                  </div>
                  <span class="item-subtotal"
                    >R$ {{ item.subtotal | number: "1.2-2" }}</span
                  >
                  <button
                    mat-icon-button
                    color="warn"
                    (click)="removerItem(item)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              } @empty {
                <p class="vazio">Nenhum item adicionado ainda.</p>
              }
            </div>

            <div class="total-row">
              <span>TOTAL</span>
              <span>R$ {{ comandaAtual.valorTotal | number: "1.2-2" }}</span>
            </div>

            <button
              mat-flat-button
              color="accent"
              class="full-width"
              [disabled]="comandaAtual.itens.length === 0"
              (click)="fecharComanda()"
            >
              FECHAR COMANDA
            </button>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .pos-layout {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
      }
      .comanda-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .comanda-input {
        flex: 1 1 220px;
        max-width: 320px;
        min-width: 0;
      }
      .comanda-bar button {
        white-space: nowrap;
        flex-shrink: 0;
      }
      .empty-state {
        text-align: center;
        color: #888;
        margin-top: 60px;
      }
      .empty-state mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
      }

      .pos-grid {
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 16px;
        flex: 1;
        min-height: 0;
      }
      .full-width {
        width: 100%;
      }

      .produtos-col {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .produtos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 8px;
        overflow-y: auto;
        align-content: start;
      }
      .produto-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        text-align: left;
        min-height: 84px;
        width: 100%;
        box-sizing: border-box;
      }
      .produto-card:hover {
        border-color: var(--pdv-primary);
      }
      .produto-card.sem-estoque {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .produto-card .nome {
        font-weight: 600;
        font-size: 0.85rem;
        width: 100%;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-word;
        line-height: 1.25;
      }
      .produto-card .preco {
        color: var(--pdv-primary);
        font-weight: 600;
        font-size: 0.85rem;
      }
      .produto-card .estoque {
        font-size: 0.72rem;
        color: #777;
      }
      .produto-card .estoque.baixo {
        color: var(--pdv-danger);
      }

      .comanda-col {
        display: flex;
        flex-direction: column;
        padding: 16px;
        min-width: 0;
      }
      .comanda-col-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .comanda-col-header h2 {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .operador {
        color: #777;
        font-size: 0.85rem;
        margin: 0 0 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .identificacao {
        color: var(--pdv-primary);
        font-weight: 600;
        font-size: 0.85rem;
        margin: -8px 0 12px;
      }
      .itens-lista {
        flex: 1;
        overflow-y: auto;
      }
      .item-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 0;
        border-bottom: 1px solid #eee;
      }
      .item-nome {
        flex: 1;
        min-width: 0;
        font-size: 0.9rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .item-qtd {
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }
      .item-subtotal {
        width: 70px;
        flex-shrink: 0;
        text-align: right;
        font-size: 0.9rem;
      }
      .vazio {
        color: #999;
        text-align: center;
        margin-top: 24px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 1.2rem;
        font-weight: 700;
        padding: 12px 0;
        border-top: 2px solid #ddd;
      }

      @media (max-width: 900px) {
        .pos-grid {
          grid-template-columns: 1fr;
        }
        .comanda-col {
          order: -1;
        } /* no celular, mostra a comanda atual antes da lista de produtos */
      }

      @media (max-width: 480px) {
        .comanda-bar {
          gap: 6px;
        }
        .comanda-input {
          flex-basis: 100%;
          max-width: 100%;
        }
        .comanda-bar button span {
          display: none;
        } /* deixa só o ícone em telas muito pequenas */
      }
    `,
  ],
})
export class PosComponent implements OnInit, OnDestroy {
  @ViewChild("comandaInput") comandaInput?: ElementRef<HTMLInputElement>;

  codigoDigitado = "";
  termoBusca = "";
  comandaAtual: Comanda | null = null;
  produtos: Produto[] = [];

  buscaSubject = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private comandasService: ComandasService,
    private produtosService: ProdutosService,
    private realtime: RealtimeService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.carregarProdutos();

    const comandaQueryParam = this.route.snapshot.queryParamMap.get("comanda");
    if (comandaQueryParam) this.buscarComanda(comandaQueryParam);

    this.subs.add(
      this.buscaSubject
        .pipe(debounceTime(300))
        .subscribe((termo) => this.carregarProdutos(termo)),
    );

    // Atualização em tempo real: se outro usuário alterar a mesma comanda
    // (ex.: adicionar produto em outro terminal), recarregamos os dados.
    this.subs.add(
      this.realtime.comandaAtualizada$.subscribe((id) => {
        if (this.comandaAtual?.id === id) this.recarregarComandaAtual();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  carregarProdutos(busca?: string): void {
    this.produtosService
      .listar(busca)
      .subscribe((produtos) => (this.produtos = produtos));
  }

  buscarComanda(identificador: string): void {
    if (!identificador?.trim()) return;
    this.comandasService.buscar(identificador.trim()).subscribe({
      next: (comanda) => {
        this.comandaAtual = comanda;
        this.codigoDigitado = "";
      },
      error: () =>
        this.snack.open("Comanda não encontrada.", "OK", { duration: 3000 }),
    });
  }

  abrirNovaComanda(): void {
    const ref = this.dialog.open(NewCommandDialogComponent, { width: "360px" });
    ref.afterClosed().subscribe((resultado?: NewCommandDialogResult) => {
      if (!resultado) return; // usuário cancelou o dialog

      this.comandasService.abrir(resultado).subscribe((res) => {
        this.buscarComanda(res.numero.toString());
      });
    });
  }

  /// Só tira a comanda da tela do PDV — NÃO fecha nem cancela nada no
  /// backend. Ela continua "Aberta" normalmente e pode ser retomada depois
  /// digitando/escaneando o número de novo, ou pela tela de Comandas
  /// Abertas. Serve para o caso de um cliente que vai demorar (ex.: só
  /// paga quando for embora) e o caixa precisa liberar a tela para atender
  /// outra comanda enquanto isso.
  voltarInicio(): void {
    this.comandaAtual = null;
    this.codigoDigitado = "";
  }

  recarregarComandaAtual(): void {
    if (!this.comandaAtual) return;
    this.comandasService
      .buscar(this.comandaAtual.numero.toString())
      .subscribe((c) => {
        // Este método também é chamado pelo evento "ComandaAtualizada" do
        // SignalR, que pode chegar DEPOIS que fecharComanda() já zerou
        // comandaAtual (corrida entre o aviso em tempo real e a resposta do
        // próprio fechamento). Sem essa checagem, a busca reatribuía a
        // comanda já fechada de volta em comandaAtual, fazendo a tela do PDV
        // parecer que ela continuava aberta. Se o status não for mais
        // "Aberta", tratamos como se a comanda tivesse sumido da tela.
        this.comandaAtual = c.status === "Aberta" ? c : null;
      });
  }

  adicionarProduto(produto: Produto): void {
    if (!this.comandaAtual) return;
    this.comandasService
      .adicionarItem(this.comandaAtual.id, produto.id, 1)
      .subscribe({
        next: () => {
          this.recarregarComandaAtual();
          this.carregarProdutos(this.termoBusca);
        },
        error: () => {}, // erro já exibido pelo interceptor global
      });
  }

  alterarQuantidade(
    item: Comanda["itens"][number],
    novaQuantidade: number,
  ): void {
    if (!this.comandaAtual) return;
    if (novaQuantidade <= 0) {
      this.removerItem(item);
      return;
    }

    this.comandasService
      .alterarQuantidade(this.comandaAtual.id, item.id, novaQuantidade)
      .subscribe({
        next: () => {
          this.recarregarComandaAtual();
          this.carregarProdutos(this.termoBusca);
        },
      });
  }

  removerItem(item: Comanda["itens"][number]): void {
    if (!this.comandaAtual) return;
    this.comandasService.removerItem(this.comandaAtual.id, item.id).subscribe({
      next: () => {
        this.recarregarComandaAtual();
        this.carregarProdutos(this.termoBusca);
      },
    });
  }

  fecharComanda(): void {
    if (!this.comandaAtual) return;

    const ref = this.dialog.open(CloseCommandDialogComponent, {
      width: "420px",
      data: { total: this.comandaAtual.valorTotal },
    });

    ref.afterClosed().subscribe((pagamentos) => {
      if (!pagamentos || !this.comandaAtual) return;
      this.comandasService.fechar(this.comandaAtual.id, pagamentos).subscribe({
        next: () => {
          this.snack.open("Comanda fechada com sucesso!", "OK", {
            duration: 3000,
          });
          this.comandaAtual = null;
        },
      });
    });
  }
}
