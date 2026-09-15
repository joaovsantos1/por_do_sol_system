import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatIconModule } from "@angular/material/icon";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <div class="login-page">
      <mat-card class="login-card">
        <img
          src="assets/logo/logo.png"
          alt="Logo da loja"
          class="login-logo"
          onerror="this.style.display='none'"
        />
        <h1>Sistema PDV</h1>

        <form [formGroup]="form" (ngSubmit)="entrar()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Usuário</mat-label>
            <input
              matInput
              formControlName="login"
              autocomplete="username"
              autofocus
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Senha</mat-label>
            <input
              matInput
              [type]="mostrarSenha ? 'text' : 'password'"
              formControlName="senha"
              autocomplete="current-password"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="mostrarSenha = !mostrarSenha"
            >
              <mat-icon>{{
                mostrarSenha ? "visibility_off" : "visibility"
              }}</mat-icon>
            </button>
          </mat-form-field>

          @if (erro) {
            <p class="erro">{{ erro }}</p>
          }

          <button
            mat-flat-button
            color="primary"
            class="full-width"
            type="submit"
            [disabled]="form.invalid || carregando"
          >
            @if (carregando) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              ENTRAR
            }
          </button>
        </form>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-page {
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--pdv-primary), #f26b38);
      }
      .login-card {
        width: 340px;
        padding: 32px 24px;
        text-align: center;
        border-radius: 12px;
      }
      .login-logo {
        max-width: 140px;
        max-height: 100px;
        margin: 0 auto 16px;
        object-fit: contain;
      }
      h1 {
        font-size: 1.3rem;
        margin: 0 0 20px;
        color: var(--pdv-primary);
      }
      .full-width {
        width: 100%;
        margin-bottom: 8px;
      }
      .erro {
        color: var(--pdv-danger);
        font-size: 0.85rem;
        margin: -4px 0 12px;
      }
    `,
  ],
})
export class LoginComponent {
  form: ReturnType<FormBuilder["group"]>;

  carregando = false;
  erro = "";
  mostrarSenha = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      login: ["", Validators.required],
      senha: ["", Validators.required],
    });
  }

  entrar(): void {
    if (this.form.invalid) return;
    this.carregando = true;
    this.erro = "";

    const { login, senha } = this.form.getRawValue();
    this.auth.login(login!, senha!).subscribe({
      next: () => this.router.navigate(["/pdv"]),
      error: () => {
        this.erro = "Usuário ou senha inválidos.";
        this.carregando = false;
      },
    });
  }
}
