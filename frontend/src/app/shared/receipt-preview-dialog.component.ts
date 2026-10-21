import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import {
  DadosComprovante,
  ImpressaoService,
} from "../core/services/impressao.service";

/// Mostra o comprovante exatamente como vai sair no papel. O recibo é
/// desenhado dentro de um iframe da própria tela (nada de window.open, que
/// o Tauri bloqueia), e o botão Imprimir imprime só o conteúdo do iframe.
/// Cancelar a caixa de impressão não fecha este diálogo.
@Component({
  selector: "app-receipt-preview-dialog",
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      {{ data.conferencia ? "Prévia da conferencia" : "Prévia do comprovante" }}
    </h2>
    <div mat-dialog-content>
      <iframe #quadro class="quadro" title="Comprovante"></iframe>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fechar</button>
      <button mat-flat-button color="primary" (click)="imprimir()">
        <mat-icon>print</mat-icon> Imprimir
      </button>
    </div>
  `,
  styles: [
    `
      .quadro {
        width: 100%;
        min-width: 320px;
        height: 460px;
        border: 1px solid #ddd;
        background: #fff;
      }
    `,
  ],
})
export class ReceiptPreviewDialogComponent implements AfterViewInit {
  @ViewChild("quadro") quadro!: ElementRef<HTMLIFrameElement>;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DadosComprovante,
    private impressao: ImpressaoService,
  ) {}

  ngAfterViewInit(): void {
    const doc = this.quadro.nativeElement.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(this.impressao.montarHtml(this.data));
    doc.close();
  }

  private readonly larguraPapelMm = 58;

  imprimir(): void {
    const janela = this.quadro.nativeElement.contentWindow;
    const doc = this.quadro.nativeElement.contentDocument;
    if (!janela || !doc) return;

    doc.getElementById("estilo-pagina")?.remove();

    janela.focus();
    janela.print();
  }
}
