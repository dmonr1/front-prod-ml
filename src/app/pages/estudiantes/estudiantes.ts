import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';

@Component({
  selector: 'app-estudiantes',
  imports: [Shell, RouterLink],
  templateUrl: './estudiantes.html',
  styleUrl: './estudiantes.scss'
})
export class Estudiantes {}
