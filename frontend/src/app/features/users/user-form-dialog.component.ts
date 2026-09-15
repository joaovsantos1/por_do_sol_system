import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  ReactiveFormsModule,
  FormGroup,
  Validators,
} from "@angular/forms";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatIcon, MatIconModule } from "@angular/material/icon";
import { UsersService, Usuario } from "../../core/services/users.service";

export interface UserFormDialogData {
  usuario?: Usuario;
}

@Component({
  selector: "app-user-form-dialog",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data?.usuario ? "Editar usuário" : "Novo usuário" }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="salvar()">
      <div mat-dialog-content class="conteudo">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="nome" />
        </mat-form-field>

        @if (!data?.usuario) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Login</mat-label>
            <input matInput formControlName="login" />
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
              <mat-icon>
                {{ mostrarSenha ? "visibility_off" : "visibility" }}
              </mat-icon>
            </button>
          </mat-form-field>
        }

        @if (data?.usuario) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nova senha (opcional)</mat-label>
            <input
              matInput
              [type]="mostrarSenha ? 'text' : 'password'"
              formControlName="novaSenha"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="mostrarSenha = !mostrarSenha"
              [attr.aria-label]="'Mostrar senha'"
              [attr.aria-pressed]="mostrarSenha"
            >
              <mat-icon>{{
                mostrarSenha ? "visibility_off" : "visibility"
              }}</mat-icon>
            </button>
            <mat-hint>Deixe em branco para manter a senha atual</mat-hint>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Perfil</mat-label>
          <mat-select formControlName="perfil">
            <mat-option value="Administrador">Administrador</mat-option>
            <mat-option value="Gerente">Gerente</mat-option>
            <mat-option value="Caixa">Caixa</mat-option>
            <mat-option value="Operador">Operador</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">
          Cancelar
        </button>
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="form.invalid"
        >
          Salvar
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .conteudo {
        display: flex;
        flex-direction: column;
        min-width: 300px;
      }
    `,
  ],
})
export class UserFormDialogComponent {
  form: ReturnType<FormBuilder["group"]>;

  mostrarSenha = false;

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService,
    public dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormDialogData | null,
  ) {
    const usuario = this.data?.usuario;

    this.form = this.fb.group({
      nome: [usuario?.nome ?? "", Validators.required],
      login: ["", usuario ? [] : Validators.required],
      senha: ["", usuario ? [] : Validators.required],
      perfil: [usuario?.perfil ?? "Operador", Validators.required],
      novaSenha: ["", usuario ? [Validators.minLength(6)] : []],
    });
  }

  salvar(): void {
    if (this.form.invalid) return;
    const valores = this.form.getRawValue();

    if (this.data?.usuario) {
      const usuarioId = this.data.usuario.id;
      this.usersService
        .editar(usuarioId, {
          nome: valores["nome"],
          perfil: valores["perfil"],
        })
        .subscribe(() => {
          const novaSenha = valores["novaSenha"];
          if (novaSenha) {
            this.usersService
              .trocarSenha(usuarioId, novaSenha)
              .subscribe(() => this.dialogRef.close(true));
          } else {
            this.dialogRef.close(true);
          }
        });
    } else {
      this.usersService
        .criar({
          nome: valores["nome"],
          login: valores["login"],
          senha: valores["senha"],
          perfil: valores["perfil"],
        })
        .subscribe(() => this.dialogRef.close(true));
    }
  }
}

// const request$ = this.data?.usuario
//   ? this.usersService.editar(this.data.usuario.id, {
//       nome: valores.nome!,
//       perfil: valores.perfil!,
//     })
//   : this.usersService.criar({
//       nome: valores.nome!,
//       login: valores.login!,
//       senha: valores.senha!,
//       perfil: valores.perfil!,
//     });

// request$.subscribe(() => this.dialogRef.close(true));
