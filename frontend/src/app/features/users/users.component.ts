import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { UsersService, Usuario } from '../../core/services/users.service';
import { UserFormDialogComponent } from './user-form-dialog.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatDialogModule],
  template: `
    <div class="header">
      <h1>Usuários</h1>
      <button mat-flat-button color="primary" (click)="novoUsuario()">
        <mat-icon>person_add</mat-icon> Novo usuário
      </button>
    </div>

    <table mat-table [dataSource]="usuarios" class="mat-elevation-z1 full-width">
      <ng-container matColumnDef="nome">
        <th mat-header-cell *matHeaderCellDef>Nome</th>
        <td mat-cell *matCellDef="let u">{{ u.nome }}</td>
      </ng-container>
      <ng-container matColumnDef="login">
        <th mat-header-cell *matHeaderCellDef>Login</th>
        <td mat-cell *matCellDef="let u">{{ u.login }}</td>
      </ng-container>
      <ng-container matColumnDef="perfil">
        <th mat-header-cell *matHeaderCellDef>Perfil</th>
        <td mat-cell *matCellDef="let u"><mat-chip>{{ u.perfil }}</mat-chip></td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let u">{{ u.ativo ? 'Ativo' : 'Inativo' }}</td>
      </ng-container>
      <ng-container matColumnDef="acoes">
        <th mat-header-cell *matHeaderCellDef>Ações</th>
        <td mat-cell *matCellDef="let u">
          <button mat-icon-button (click)="editar(u)" title="Editar"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button (click)="alternarAtivo(u)" [title]="u.ativo ? 'Inativar' : 'Ativar'">
            <mat-icon>{{ u.ativo ? 'block' : 'check_circle' }}</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="colunas"></tr>
      <tr mat-row *matRowDef="let row; columns: colunas;"></tr>
    </table>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; }
    .full-width { width: 100%; margin-top: 12px; }
  `]
})
export class UsersComponent implements OnInit {
  usuarios: Usuario[] = [];
  colunas = ['nome', 'login', 'perfil', 'status', 'acoes'];

  constructor(private usersService: UsersService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.usersService.listar().subscribe(u => this.usuarios = u);
  }

  novoUsuario(): void {
    const ref = this.dialog.open(UserFormDialogComponent, { width: '380px' });
    ref.afterClosed().subscribe(criado => { if (criado) this.carregar(); });
  }

  editar(usuario: Usuario): void {
    const ref = this.dialog.open(UserFormDialogComponent, { width: '380px', data: { usuario } });
    ref.afterClosed().subscribe(editado => { if (editado) this.carregar(); });
  }

  alternarAtivo(usuario: Usuario): void {
    this.usersService.alternarAtivo(usuario.id, !usuario.ativo).subscribe(() => this.carregar());
  }
}
