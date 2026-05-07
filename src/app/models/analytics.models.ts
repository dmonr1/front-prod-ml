export type RiskLevel = 'Alto' | 'Medio' | 'Bajo';

export interface Kpi {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'violet' | 'red' | 'amber' | 'green';
  icon: string;
}

export interface StudentRisk {
  name: string;
  program: string;
  course: string;
  risk: RiskLevel;
  probability: number;
}

export interface StudentProfile {
  code: string;
  name: string;
  program: string;
  semester: string;
  status: string;
  average: number;
  attendance: number;
  risk: RiskLevel;
  probability: number;
}

export interface BarMetric {
  label: string;
  value: number;
  tone?: string;
}

export interface AlertItem {
  title: string;
  meta: string;
  tone: 'red' | 'amber' | 'green' | 'blue';
}
