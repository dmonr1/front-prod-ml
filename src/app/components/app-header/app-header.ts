import { Component, input } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss'
})
export class AppHeader {
  readonly title = input<string>('');
}
