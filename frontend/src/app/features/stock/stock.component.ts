import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ProdutosService } from '../../core/services/produtos.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, MatTableModule],
  template: `
    <h1>Estoque baixo</h1>
    <table mat-table [dataSource]="itens" class="mat-elevation-z1 full-width">
      <ng-container matColumnDef="nome">
        <th mat-header-cell *matHeaderCellDef>Produto</th>
        <td mat-cell *matCellDef="let i">{{ i.nome }}</td>
      </ng-container>
      <ng-container matColumnDef="atual">
        <th mat-header-cell *matHeaderCellDef>Estoque atual</th>
        <td mat-cell *matCellDef="let i" class="danger">{{ i.estoqueAtual }}</td>
      </ng-container>
      <ng-container matColumnDef="minimo">
        <th mat-header-cell *matHeaderCellDef>Mínimo</th>
        <td mat-cell *matCellDef="let i">{{ i.estoqueMinimo }}</td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="colunas"></tr>
      <tr mat-row *matRowDef="let row; columns: colunas;"></tr>
    </table>
    @if (itens.length === 0) {
      <p class="ok">Nenhum produto com estoque baixo. 🎉</p>
    }
  `,
  styles: [`
    .full-width { width: 100%; margin-top: 12px; }
    .danger { color: var(--pdv-danger); font-weight: 700; }
    .ok { color: var(--pdv-success); margin-top: 16px; }
  `]
})
export class StockComponent implements OnInit {
  itens: { id: string; nome: string; estoqueAtual: number; estoqueMinimo: number }[] = [];
  colunas = ['nome', 'atual', 'minimo'];

  constructor(private produtosService: ProdutosService) {}

  ngOnInit(): void {
    this.produtosService.estoqueBaixo().subscribe(i => this.itens = i);
  }
}
