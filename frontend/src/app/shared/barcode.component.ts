import { Component, Input, AfterViewInit, OnChanges, ViewChild, ElementRef } from '@angular/core';
import JsBarcode from 'jsbarcode';

/// Renderiza o código de barras diretamente no navegador a partir do
/// identificador da comanda (string simples, ex.: "COMANDA-000152") — não
/// depende de imagem gerada no backend. Usado na tela de detalhe da
/// comanda para impressão/exibição.
@Component({
  selector: 'app-barcode',
  standalone: true,
  template: `<svg #svg></svg>`
})
export class BarcodeComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) valor!: string;
  @ViewChild('svg') svgRef!: ElementRef<SVGElement>;

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(): void {
    if (this.svgRef) this.render();
  }

  private render(): void {
    try {
      JsBarcode(this.svgRef.nativeElement, this.valor, {
        format: 'CODE128',
        displayValue: true,
        height: 50,
        width: 1.6,
        fontSize: 12
      });
    } catch {
      // valor vazio/ inválido durante o primeiro ciclo de render — ignora
    }
  }
}
