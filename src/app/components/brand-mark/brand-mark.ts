import { Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  templateUrl: './brand-mark.html',
  styleUrl: './brand-mark.scss'
})
export class BrandMark {
  readonly compact = input(false);
}
