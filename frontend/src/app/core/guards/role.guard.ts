import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/// Restrição de rota por perfil no FRONTEND — apenas para UX (esconder
/// telas que o usuário não deveria ver). A validação real e definitiva de
/// permissão é sempre feita no backend (ver [Authorize(Roles=...)] na API);
/// esta guarda nunca deve ser tratada como mecanismo de segurança por si só.
export function roleGuard(perfisPermitidos: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.temPerfil(perfisPermitidos)) return true;

    router.navigate(['/pdv']);
    return false;
  };
}
