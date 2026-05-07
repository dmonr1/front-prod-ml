import { Component } from '@angular/core';
import { AppHeader } from '../../components/app-header/app-header';
import { Shell } from '../../layouts/shell/shell';

@Component({
  selector: 'app-usuario',
  imports: [Shell, AppHeader],
  templateUrl: './usuario.html',
  styleUrl: './usuario.scss'
})
export class Usuario {}
