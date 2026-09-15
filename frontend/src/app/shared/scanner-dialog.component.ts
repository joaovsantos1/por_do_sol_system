import { Component, ViewChild, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";

import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

import {
  NgxScannerQrcodeComponent,
  ScannerQRCodeResult,
} from "ngx-scanner-qrcode";

@Component({
  selector: "app-scanner-dialog",
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    NgxScannerQrcodeComponent,
  ],
  template: `
    <h2 mat-dialog-title>Aponte a câmera para o QR Code da comanda</h2>

    <div mat-dialog-content>
      <ngx-scanner-qrcode #scanner="scanner" (event)="onEvent($event)">
      </ngx-scanner-qrcode>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
    </div>
  `,
})
export class ScannerDialogComponent implements AfterViewInit {
  @ViewChild("scanner")
  scanner!: NgxScannerQrcodeComponent;

  constructor(public dialogRef: MatDialogRef<ScannerDialogComponent>) {}

  ngAfterViewInit(): void {
    this.scanner.start();
  }

  onEvent(resultados: ScannerQRCodeResult[]): void {
    const valor = resultados?.[0]?.value;

    if (valor) {
      this.scanner.stop();

      // O QR contém o CodigoIdentificador puro
      // (ex.: "COMANDA-000152").
      // Extrai só o número final para reaproveitar
      // a busca por número.
      const numero = valor.match(/(\d+)$/)?.[1] ?? valor;

      this.dialogRef.close(numero);
    }
  }
}
