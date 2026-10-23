import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, ButtonModule],
  template: `
    <section class="error-page">
      <h1>403</h1>
      <p>Bu bo‘limga kirish uchun ruxsatingiz yo‘q.</p>
      <a routerLink="/"><p-button label="Bosh sahifaga" icon="pi pi-home" /></a>
    </section>
  `,
  styleUrl: './error-pages.scss',
})
export class Forbidden {}

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, ButtonModule],
  template: `
    <section class="error-page">
      <h1>404</h1>
      <p>Sahifa topilmadi.</p>
      <a routerLink="/"><p-button label="Bosh sahifaga" icon="pi pi-home" /></a>
    </section>
  `,
  styleUrl: './error-pages.scss',
})
export class NotFound {}
