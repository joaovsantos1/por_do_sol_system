import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        auth.logout();
        router.navigate(['/login']);
        snackBar.open('Sessão expirada. Faça login novamente.', 'OK', { duration: 4000 });
      } else if (error.status === 403) {
        snackBar.open('Você não tem permissão para esta ação.', 'OK', { duration: 4000 });
      } else {
        const mensagem = error.error?.erro || 'Ocorreu um erro inesperado.';
        snackBar.open(mensagem, 'OK', { duration: 5000 });
      }
      return throwError(() => error);
    })
  );
};
