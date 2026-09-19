import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
} from "@angular/router";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatListModule } from "@angular/material/list";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AuthService } from "../core/services/auth.service";
import { RealtimeService } from "../core/services/realtime.service";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  template: `
    <mat-sidenav-container class="shell-container">
      <mat-sidenav mode="side" opened class="sidebar">
        <div class="brand">
          <img
            src="assets/logo/logo.png"
            alt="Logo"
            onerror="this.style.display='none'"
          />
          <span class="brand-text">PDV Sistema</span>
        </div>

        <mat-nav-list>
          <a
            mat-list-item
            routerLink="/pdv"
            routerLinkActive="active"
            matTooltip="PDV"
            matTooltipPosition="right"
          >
            <mat-icon matListItemIcon style="color: #fffffff;"
              >point_of_sale</mat-icon
            >
            <span matListItemTitle class="nav-text">PDV</span>
          </a>
          <a
            mat-list-item
            routerLink="/comandas-abertas"
            routerLinkActive="active"
            matTooltip="Comandas Abertas"
            matTooltipPosition="right"
          >
            <mat-icon matListItemIcon style="color: #fffffff;"
              >receipt_long</mat-icon
            >
            <span matListItemTitle class="nav-text">Comandas Abertas</span>
          </a>

          @if (auth.temPerfil(["Administrador", "Gerente"])) {
            <a
              mat-list-item
              routerLink="/historico-comandas"
              routerLinkActive="active"
              matTooltip="Histórico de Comandas"
              matTooltipPosition="right"
            >
              <mat-icon matListItemIcon style="color: #fffffff;"
                >history</mat-icon
              >
              <span matListItemTitle class="nav-text">Histórico</span>
            </a>
            <a
              mat-list-item
              routerLink="/dashboard"
              routerLinkActive="active"
              matTooltip="Dashboard"
              matTooltipPosition="right"
            >
              <mat-icon matListItemIcon style="color: #fffffff;"
                >dashboard</mat-icon
              >
              <span matListItemTitle class="nav-text">Dashboard</span>
            </a>
            <a
              mat-list-item
              routerLink="/produtos"
              routerLinkActive="active"
              matTooltip="Produtos"
              matTooltipPosition="right"
            >
              <mat-icon matListItemIcon style="color: #fffffff;"
                >inventory_2</mat-icon
              >
              <span matListItemTitle class="nav-text">Produtos</span>
            </a>
            <a
              mat-list-item
              routerLink="/estoque"
              routerLinkActive="active"
              matTooltip="Estoque"
              matTooltipPosition="right"
            >
              <mat-icon matListItemIcon style="color: #fffffff;"
                >warehouse</mat-icon
              >
              <span matListItemTitle class="nav-text">Estoque</span>
            </a>
            <a
              mat-list-item
              routerLink="/valorizacao-estoque"
              routerLinkActive="active"
              matTooltip="Valorização de Estoque"
              matTooltipPosition="right"
            >
              <mat-icon matListItemIcon>payments</mat-icon>
              <span matListItemTitle class="nav-text">Valorização</span>
            </a>
          }
          @if (auth.temPerfil(["Administrador"])) {
            <a
              mat-list-item
              routerLink="/usuarios"
              routerLinkActive="active"
              matTooltip="Usuários"
              matTooltipPosition="right"
            >
              <mat-icon matListItemIcon style="color: #fffffff;"
                >people</mat-icon
              >
              <span matListItemTitle class="nav-text">Usuários</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="content-area">
        <mat-toolbar class="topbar">
          <span class="spacer"></span>
          <span class="usuario">
            <span class="usuario-nome">{{ auth.usuario()?.nome }}</span>
            <span class="usuario-perfil">{{ auth.usuario()?.perfil }}</span>
          </span>
          <button
            mat-stroked-button
            class="btn-sair"
            (click)="sair()"
            aria-label="Sair do sistema"
          >
            <mat-icon>logout</mat-icon>
            <span class="sair-texto">Sair</span>
          </button>
        </mat-toolbar>

        <div class="pdv-content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      /* mat-sidenav-container já controla seu próprio layout interno — aqui
       só definimos a altura total da tela, sem impor display:flex, que
       colidia com o posicionamento interno do Material e causava textos
       sobrepostos. */
      .shell-container {
        height: 100vh;
      }

      .sidebar {
        width: 220px;
        background: #111111;
        color: #ffffff;
        display: flex;
        flex-direction: column;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px;
        font-weight: 600;
        overflow: hidden;
        white-space: nowrap;
      }
      .brand img {
        max-height: 32px;
        flex-shrink: 0;
      }
      .brand-text {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      mat-nav-list a {
        color: #ffffff;
      }
      mat-nav-list a:hover {
        background: #e85d04;
        color: #ffffff;
      }
      mat-nav-list a.active {
        background: #f26b38;
        color: #ffffff;
      }
      mat-nav-list a mat-icon {
        color: #ffffff;
      }

      .nav-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #ffffff;
      }

      .content-area {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .topbar {
        background: #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        z-index: 2;
      }
      .spacer {
        flex: 1;
        min-width: 0;
      }

      .usuario {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.2;
        max-width: 220px;
        overflow: hidden;
        flex-shrink: 1;
      }
      .usuario-nome {
        font-size: 0.9rem;
        color: #222;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      .usuario-perfil {
        font-size: 0.75rem;
        color: #888;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      .btn-sair {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        white-space: nowrap;
      }

      .pdv-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        min-height: 0;
      }

      @media (max-width: 768px) {
        .sidebar {
          width: 56px;
        }
        .brand-text,
        .nav-text {
          display: none;
        }
        .brand {
          justify-content: center;
          padding: 12px 4px;
        }

        .usuario-perfil {
          display: none;
        }
        .usuario {
          max-width: 90px;
        }
        .sair-texto {
          display: none;
        }
        .btn-sair {
          min-width: 40px;
          padding: 0 8px;
        }
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  constructor(
    public auth: AuthService,
    private router: Router,
    private realtime: RealtimeService,
  ) {}

  ngOnInit(): void {
    this.realtime.conectar();
  }

  sair(): void {
    this.realtime.desconectar();
    this.auth.logout();
    this.router.navigate(["/login"]);
  }
}
