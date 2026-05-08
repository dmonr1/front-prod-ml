import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';

@Component({
  selector: 'app-perfil-alumno',
  imports: [Shell, RouterLink],
  templateUrl: './perfil-alumno.html',
  styleUrl: './perfil-alumno.scss'
})
export class PerfilAlumno {}
