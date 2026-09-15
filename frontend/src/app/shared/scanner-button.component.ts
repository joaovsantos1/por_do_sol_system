import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ScannerDialogComponent } from './scanner-dialog.component';

/// Botão que abre a câmera do celular para ler o QR Code da comanda.
/// O leitor de código de barras USB não precisa deste componente: ele
/// funciona como teclado, então basta o campo de texto do PDV estar em
/// foco (ver pos.component.ts) para capturar a leitura diretamente.
@Component({
  selector: 'app-scanner-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <button mat-stroked-button type="button" (click)="abrirCamera()">
      <mat-icon>qr_code_scanner</mat-icon> <span>Escanear</span>
    </button>
  `
})
export class ScannerButtonComponent {
  @Output() lido = new EventEmitter<string>();

  constructor(private dialog: MatDialog) {}

  abrirCamera(): void {
    const ref = this.dialog.open(ScannerDialogComponent, { width: '360px' });
    ref.afterClosed().subscribe((codigo: string | undefined) => {
      if (codigo) this.lido.emit(codigo);
    });
  }
}
