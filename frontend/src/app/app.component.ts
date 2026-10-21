import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AppUpdateService } from "./core/services/app-update.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {
  constructor(private appUpdateService: AppUpdateService) {}

  ngOnInit(): void {
    this.appUpdateService.verificarAtualizacao();
  }
}
