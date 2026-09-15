import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/// Encapsula a conexão SignalR para atualizações em tempo real de comandas e
/// estoque, evitando que as telas precisem dar polling manual na API.
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private comandasConnection?: signalR.HubConnection;

  comandaAtualizada$ = new Subject<string>();
  comandaAberta$ = new Subject<string>();

  constructor(private auth: AuthService) {}

  conectar(): void {
    if (this.comandasConnection) return;

    this.comandasConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/comandas`, {
        accessTokenFactory: () => this.auth.token ?? ''
      })
      .withAutomaticReconnect()
      .build();

    this.comandasConnection.on('ComandaAtualizada', (id: string) => this.comandaAtualizada$.next(id));
    this.comandasConnection.on('ComandaAberta', (id: string) => this.comandaAberta$.next(id));

    this.comandasConnection.start().catch(err => console.error('Erro ao conectar SignalR:', err));
  }

  desconectar(): void {
    this.comandasConnection?.stop();
    this.comandasConnection = undefined;
  }
}
