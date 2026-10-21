import { Injectable } from "@angular/core";

export interface ItemComprovante {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface DadosComprovante {
  numeroComanda: number;
  numeroMesa?: number;
  nomeCliente?: string;
  itens: ItemComprovante[];
  subtotal: number;
  desconto: number;
  taxaServico: number;
  total: number;
  pagamentos: { forma: string; valor: number }[];
  dataHora: Date | string;
  segundaVia?: boolean;
  /// Conferência de consumo: impressa ANTES do pagamento, para o cliente
  /// ver o que consumiu. Não mostra formas de pagamento.
  conferencia?: boolean;
}

/// Só monta o HTML do comprovante (formato de recibo estreito). Quem exibe
/// a prévia e dispara a impressão é o ReceiptPreviewDialogComponent.
@Injectable({ providedIn: "root" })
export class ImpressaoService {
  /// Ajuste fino do recibo no papel de 58mm. Se sair deslocado para a
  /// direita, diminua margemEsquerdaMm (aceita valores como 0 ou -1); se
  /// o texto for cortado na borda direita, diminua larguraReciboMm.
  private readonly larguraReciboMm = 48;
  private readonly margemEsquerdaMm = 0;

  private readonly rotulosFormaPagamento: Record<string, string> = {
    Pix: "PIX",
    Dinheiro: "DINHEIRO",
    CartaoCredito: "CARTÃO CRÉDITO",
    CartaoDebito: "CARTÃO DÉBITO",
    Cartao: "CARTÃO",
  };

  montarHtml(dados: DadosComprovante): string {
    const linhaItem = (item: ItemComprovante) => `
      <tr><td colspan="2">${this.escapar(item.nome)}</td></tr>
      <tr>
        <td>${item.quantidade} x ${this.formatarMoeda(item.precoUnitario)}</td>
        <td class="direita">${this.formatarMoeda(item.subtotal)}</td>
      </tr>`;

    const linhaPagamento = (p: { forma: string; valor: number }) => `
      <tr>
        <td>${this.rotulosFormaPagamento[p.forma] ?? this.escapar(p.forma)}</td>
        <td class="direita">${this.formatarMoeda(p.valor)}</td>
      </tr>`;

    const dataHora = new Date(dados.dataHora);
    const titulo = dados.conferencia
      ? "CONFERÊNCIA DE CONSUMO"
      : "COMPROVANTE DE VENDA";

    let aviso = "";
    if (dados.conferencia)
      aviso = '<div class="via">*** AGUARDANDO PAGAMENTO ***</div>';
    else if (dados.segundaVia) aviso = '<div class="via">*** 2ª VIA ***</div>';

    const blocoPagamentos = dados.conferencia
      ? ""
      : `<hr><table>${dados.pagamentos.map(linhaPagamento).join("")}</table>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Comprovante</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: auto; background: #fff; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
  .recibo { width: ${this.larguraReciboMm}mm; margin: 0 0 0 ${this.margemEsquerdaMm}mm; padding: 0 0 12mm 0; position: static; transform: none; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  .via { text-align: center; font-weight: bold; margin-bottom: 4px; }
  .info { text-align: center; font-size: 11px; margin-bottom: 8px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .direita { text-align: right; }
  .total-row td { font-weight: bold; font-size: 14px; padding-top: 6px; }
  .rodape { text-align: center; font-size: 10px; margin-top: 12px; }
</style>
</head>
<body>
<div class="recibo" id="recibo">
  <h1>QUIOSQUE POR DO SOL</h1>
  <h1>${titulo}</h1>
  ${aviso}
  <div class="info">
    Comanda #${dados.numeroComanda}
    ${dados.numeroMesa ? `— Mesa ${dados.numeroMesa}` : ""}
    ${dados.nomeCliente ? `— ${this.escapar(dados.nomeCliente)}` : ""}
    <br>${dataHora.toLocaleString("pt-BR")}
  </div>
  <hr>
  <table>${dados.itens.map(linhaItem).join("")}</table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td class="direita">${this.formatarMoeda(dados.subtotal)}</td></tr>
    ${dados.desconto > 0 ? `<tr><td>Desconto</td><td class="direita">-${this.formatarMoeda(dados.desconto)}</td></tr>` : ""}
    ${dados.taxaServico > 0 ? `<tr><td>Taxa de serviço</td><td class="direita">${this.formatarMoeda(dados.taxaServico)}</td></tr>` : ""}
    <tr class="total-row"><td>TOTAL</td><td class="direita">${this.formatarMoeda(dados.total)}</td></tr>
  </table>
  ${blocoPagamentos}
  <div class="rodape">Obrigado pela preferência!</div>
  </div>
</body>
</html>`;
  }

  private formatarMoeda(valor: number): string {
    return `R$ ${valor.toFixed(2).replace(".", ",")}`;
  }

  private escapar(texto: string): string {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
  }
}
