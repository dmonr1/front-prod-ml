import { Injectable } from '@angular/core';
import { AlertItem, BarMetric, Kpi, StudentProfile, StudentRisk } from '../models/analytics.models';

@Injectable({ providedIn: 'root' })
export class MockAnalyticsService {
  readonly adminKpis: Kpi[] = [
    { label: 'Estudiantes totales', value: '2,458', detail: '+12.5% vs bimestre anterior', tone: 'blue', icon: 'users' },
    { label: 'En riesgo alto', value: '325', detail: '13.2% del total', tone: 'red', icon: 'alert' },
    { label: 'En riesgo medio', value: '586', detail: '23.9% del total', tone: 'amber', icon: 'clock' },
    { label: 'Rendimiento promedio', value: '76.4%', detail: '+3.4% vs bimestre anterior', tone: 'green', icon: 'trend' },
    { label: 'Permanencia escolar', value: '88.7%', detail: '+2.1% proyectado', tone: 'violet', icon: 'shield' }
  ];

  readonly docenteKpis: Kpi[] = [
    { label: 'Cursos asignados', value: '4', detail: 'Año escolar 2024', tone: 'violet', icon: 'book' },
    { label: 'Estudiantes', value: '128', detail: 'Matriculados activos', tone: 'blue', icon: 'users' },
    { label: 'En riesgo alto', value: '18', detail: '14.1% del total', tone: 'red', icon: 'alert' },
    { label: 'Rendimiento promedio', value: '74.2%', detail: '-2.1% vs institución', tone: 'green', icon: 'trend' }
  ];

  readonly reportKpis: Kpi[] = [
    { label: 'Estudiantes', value: '2,458', detail: 'Muestra filtrada', tone: 'blue', icon: 'users' },
    { label: 'Promedio general', value: '76.4%', detail: 'Rendimiento escolar', tone: 'violet', icon: 'trend' },
    { label: 'Riesgo alto', value: '325', detail: '13.2% del total', tone: 'red', icon: 'alert' },
    { label: 'Riesgo medio', value: '586', detail: '23.9% del total', tone: 'amber', icon: 'clock' },
    { label: 'Riesgo bajo', value: '1,547', detail: '62.9% del total', tone: 'green', icon: 'shield' }
  ];

  readonly riskBars: BarMetric[] = [
    { label: 'Riesgo bajo', value: 63, tone: '#32c7c9' },
    { label: 'Riesgo medio', value: 24, tone: '#f6b54b' },
    { label: 'Riesgo alto', value: 13, tone: '#f0526b' }
  ];

  readonly riskTrend = [34, 35, 42, 39, 41, 36];
  readonly performanceTrend = [56, 74, 62, 86, 75, 52];

  readonly programPerformance: BarMetric[] = [
    { label: '1ro de secundaria', value: 78 },
    { label: '2do de secundaria', value: 74 },
    { label: '3ro de secundaria', value: 73 },
    { label: '4to de secundaria', value: 72 },
    { label: '5to de secundaria', value: 70 }
  ];

  readonly coursePerformance: BarMetric[] = [
    { label: 'Matemática', value: 78 },
    { label: 'Comunicación', value: 72 },
    { label: 'Ciencia y Tecnología', value: 68 },
    { label: 'Ciencias Sociales', value: 54 }
  ];

  readonly highRiskStudents: StudentRisk[] = [
    { name: 'Ana Lucía Morales', program: '3ro B Secundaria', course: 'Matemática', risk: 'Alto', probability: 92 },
    { name: 'Carlos Andrés Ruiz', program: '4to A Secundaria', course: 'Ciencia y Tecnología', risk: 'Alto', probability: 89 },
    { name: 'María Fernanda López', program: '2do C Secundaria', course: 'Comunicación', risk: 'Alto', probability: 87 },
    { name: 'Diego Alejandro Torres', program: '5to A Secundaria', course: 'Ciencias Sociales', risk: 'Alto', probability: 85 },
    { name: 'Valentina Castillo', program: '1ro B Secundaria', course: 'Matemática', risk: 'Alto', probability: 84 }
  ];

  readonly students: StudentProfile[] = [
    { code: 'EST-2024-001', name: 'Juan Pablo Torres', program: '5to A Secundaria', semester: '5to grado', status: 'Activo', average: 75.6, attendance: 88, risk: 'Alto', probability: 86 },
    { code: 'EST-2024-002', name: 'Ana Lucía Morales', program: '3ro B Secundaria', semester: '3er grado', status: 'Activo', average: 68.4, attendance: 81, risk: 'Alto', probability: 92 },
    { code: 'EST-2024-003', name: 'Carlos Andrés Ruiz', program: '4to A Secundaria', semester: '4to grado', status: 'Observación', average: 70.1, attendance: 84, risk: 'Alto', probability: 89 },
    { code: 'EST-2024-004', name: 'María Fernanda López', program: '2do C Secundaria', semester: '2do grado', status: 'Activo', average: 73.8, attendance: 90, risk: 'Alto', probability: 87 },
    { code: 'EST-2024-005', name: 'Diego Alejandro Torres', program: '5to A Secundaria', semester: '5to grado', status: 'Activo', average: 72.5, attendance: 86, risk: 'Alto', probability: 85 },
    { code: 'EST-2024-006', name: 'Valentina Castillo', program: '1ro B Secundaria', semester: '1er grado', status: 'Activo', average: 74.9, attendance: 89, risk: 'Alto', probability: 84 },
    { code: 'EST-2024-007', name: 'Sofía Ramírez', program: '6to A Primaria', semester: '6to grado', status: 'Activo', average: 80.2, attendance: 94, risk: 'Medio', probability: 58 },
    { code: 'EST-2024-008', name: 'Luis Fernando Vega', program: '4to C Secundaria', semester: '4to grado', status: 'Activo', average: 82.1, attendance: 96, risk: 'Bajo', probability: 24 }
  ];

  readonly alerts: AlertItem[] = [
    { title: '45 estudiantes en riesgo alto en secundaria', meta: 'Hace 1 hora', tone: 'red' },
    { title: '32 estudiantes con caída de rendimiento significativa', meta: 'Hace 3 horas', tone: 'amber' },
    { title: 'Nuevo modelo de predicción escolar disponible v2.3', meta: 'Hace 5 horas', tone: 'green' }
  ];
}
