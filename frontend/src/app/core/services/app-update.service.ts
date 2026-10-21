import { Injectable } from "@angular/core";
import { check } from "@tauri-apps/plugin-updater";

@Injectable({
  providedIn: "root",
})
export class AppUpdateService {
  async verificarAtualizacao(): Promise<void> {
    try {
      const update = await check();

      if (update) {
        console.log(`Atualização disponível: ${update.version}`);
      } else {
        console.log("PDV já está atualizado.");
      }
    } catch (error) {
      console.error("Erro ao verificar atualização:", error);
    }
  }
}
