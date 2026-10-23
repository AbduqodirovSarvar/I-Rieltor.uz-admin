import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { watchSession } from './core/auth/session-watcher';

@Component({
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    watchSession();
  }
}
