import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ComandasService, ComandaResumo } from '../../core/services/comandas.service';
import { RealtimeService } from '../../core/services/realtime.service';

@Component({
  selector: 'app-open-commands',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h1>Comandas Abertas</h1>

    <mat-form-field appearance="outline" style="max-width: 300px;">
      <mat-label>Buscar por número ou operador</mat-label>
      <input matInput [(ngModel)]="filtro">
    </mat-form-field>

    <div class="grid">
      @for (comanda of comandasFiltradas; track comanda.id) {
        <mat-card class="card">
          <h3>Comanda #{{ comanda.numero }}</h3>
          <p>Aberta: {{ comanda.abertaEm | date:'HH:mm' }}</p>
          <p>Itens: {{ comanda.itens }}</p>
          <p class="total">Total: R$ {{ comanda.valorTotal | number:'1.2-2' }}</p>
          <p class="usuario">Usuário: {{ comanda.abertaPor }}</p>
          <button mat-flat-button color="primary" (click)="abrir(comanda)">ABRIR</button>
        </mat-card>
      } @empty {
        <p class="vazio">Nenhuma comanda aberta no momento.</p>
      }
    </div>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; }
    .card { padding: 16px; }
    .card h3 { margin: 0 0 8px; }
    .card p { margin: 2px 0; font-size: 0.9rem; color: #555; }
    .total { font-weight: 700; color: var(--pdv-primary); }
    .card button { margin-top: 8px; width: 100%; }
    .vazio { color: #999; }
  `]
})
export class OpenCommandsComponent implements OnInit, OnDestroy {
  comandas: ComandaResumo[] = [];
  filtro = '';
  private subs = new Subscription();

  constructor(
    private comandasService: ComandasService,
    private realtime: RealtimeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.subs.add(this.realtime.comandaAtualizada$.subscribe(() => this.carregar()));
    this.subs.add(this.realtime.comandaAberta$.subscribe(() => this.carregar()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  carregar(): void {
    this.comandasService.listarAbertas().subscribe(c => this.comandas = c);
  }

  get comandasFiltradas(): ComandaResumo[] {
    if (!this.filtro.trim()) return this.comandas;
    const termo = this.filtro.toLowerCase();
    return this.comandas.filter(c =>
      c.numero.toString().includes(termo) || c.abertaPor.toLowerCase().includes(termo));
  }

  abrir(comanda: ComandaResumo): void {
    // Reaproveita a tela do PDV, já com a comanda carregada.
    this.router.navigate(['/pdv'], { queryParams: { comanda: comanda.numero } });
  }
}
