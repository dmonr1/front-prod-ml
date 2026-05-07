import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMark } from '../../../components/brand-mark/brand-mark';

@Component({
  selector: 'app-login',
  imports: [RouterLink, BrandMark],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {}
