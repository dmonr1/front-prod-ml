import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';

interface CalendarCell {
  day: number | null;
  value: string | null;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss'
})
export class DatePickerComponent implements OnChanges {
  private static abiertaActual: DatePickerComponent | null = null;
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private animationTimeoutId: ReturnType<typeof setTimeout> | null = null;

  @Input() value = '';
  @Input() placeholder = 'dd/mm/aaaa';
  @Input() disabled = false;
  @Input() minYear = 2020;
  @Input() maxYear = 2030;

  @Output() valueChange = new EventEmitter<string>();

  abierto = false;
  monthMenuOpen = false;
  yearMenuOpen = false;
  calendarAnimation: 'slide-next' | 'slide-prev' | '' = '';
  visibleMonth = 0;
  visibleYear = 2026;

  readonly monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];

  readonly weekDays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['minYear'] || changes['maxYear']) {
      this.sincronizarVista();
    }
  }

  get years(): number[] {
    return Array.from(
      { length: this.maxYear - this.minYear + 1 },
      (_, index) => this.minYear + index
    );
  }

  get displayValue(): string {
    if (!this.value) {
      return '';
    }

    const [year, month, day] = this.value.split('-');
    if (!year || !month || !day) {
      return '';
    }

    return `${day}/${month}/${year}`;
  }

  get monthLabel(): string {
    return `${this.monthNames[this.visibleMonth]} ${this.visibleYear}`;
  }

  get canGoPrevious(): boolean {
    return !(this.visibleYear === this.minYear && this.visibleMonth === 0);
  }

  get canGoNext(): boolean {
    return !(this.visibleYear === this.maxYear && this.visibleMonth === 11);
  }

  get calendarCells(): CalendarCell[] {
    const firstDay = new Date(this.visibleYear, this.visibleMonth, 1);
    const daysInMonth = new Date(this.visibleYear, this.visibleMonth + 1, 0).getDate();
    const jsDay = firstDay.getDay();
    const mondayOffset = (jsDay + 6) % 7;
    const cells: CalendarCell[] = [];
    const today = this.toDateString(new Date());

    for (let index = 0; index < mondayOffset; index += 1) {
      cells.push({
        day: null,
        value: null,
        inMonth: false,
        isToday: false,
        isSelected: false
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const value = this.formatDate(this.visibleYear, this.visibleMonth, day);
      cells.push({
        day,
        value,
        inMonth: true,
        isToday: value === today,
        isSelected: value === this.value
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        day: null,
        value: null,
        inMonth: false,
        isToday: false,
        isSelected: false
      });
    }

    return cells;
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }

    if (!this.abierto && DatePickerComponent.abiertaActual && DatePickerComponent.abiertaActual !== this) {
      DatePickerComponent.abiertaActual.close();
    }

    this.abierto = !this.abierto;
    if (this.abierto) {
      DatePickerComponent.abiertaActual = this;
      this.sincronizarVista();
    } else if (DatePickerComponent.abiertaActual === this) {
      DatePickerComponent.abiertaActual = null;
    }
  }

  close(): void {
    this.abierto = false;
    this.monthMenuOpen = false;
    this.yearMenuOpen = false;
    if (DatePickerComponent.abiertaActual === this) {
      DatePickerComponent.abiertaActual = null;
    }
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled) {
      return;
    }

    this.valueChange.emit('');
    this.value = '';
    this.sincronizarVista();
  }

  selectDate(cell: CalendarCell): void {
    if (!cell.value || this.disabled) {
      return;
    }

    this.value = cell.value;
    this.valueChange.emit(cell.value);
    this.close();
  }

  previousMonth(): void {
    if (!this.canGoPrevious) {
      return;
    }

    this.playCalendarAnimation('slide-prev');

    if (this.visibleMonth === 0) {
      this.visibleMonth = 11;
      this.visibleYear -= 1;
      return;
    }

    this.visibleMonth -= 1;
  }

  nextMonth(): void {
    if (!this.canGoNext) {
      return;
    }

    this.playCalendarAnimation('slide-next');

    if (this.visibleMonth === 11) {
      this.visibleMonth = 0;
      this.visibleYear += 1;
      return;
    }

    this.visibleMonth += 1;
  }

  changeMonth(month: string): void {
    const nextMonth = Number(month);
    this.playCalendarAnimation(nextMonth >= this.visibleMonth ? 'slide-next' : 'slide-prev');
    this.visibleMonth = Number(month);
    this.monthMenuOpen = false;
  }

  changeYear(year: string): void {
    const nextYear = Number(year);
    this.playCalendarAnimation(nextYear >= this.visibleYear ? 'slide-next' : 'slide-prev');
    this.visibleYear = Number(year);
    this.yearMenuOpen = false;
  }

  toggleMonthMenu(event?: Event): void {
    event?.stopPropagation();
    this.monthMenuOpen = !this.monthMenuOpen;
    if (this.monthMenuOpen) {
      this.yearMenuOpen = false;
    }
  }

  toggleYearMenu(event?: Event): void {
    event?.stopPropagation();
    this.yearMenuOpen = !this.yearMenuOpen;
    if (this.yearMenuOpen) {
      this.monthMenuOpen = false;
    }
  }

  selectMonth(monthIndex: number): void {
    this.changeMonth(String(monthIndex));
  }

  selectYear(year: number): void {
    this.changeYear(String(year));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.abierto) {
      return;
    }

    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  private sincronizarVista(): void {
    const parsed = this.parseValue(this.value);

    if (parsed) {
      this.visibleYear = this.clampYear(parsed.year);
      this.visibleMonth = parsed.month;
      return;
    }

    const now = new Date();
    this.visibleYear = this.clampYear(now.getFullYear());
    this.visibleMonth = now.getMonth();
  }

  private parseValue(value: string): { year: number; month: number; day: number } | null {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }

    return {
      year,
      month: month - 1,
      day
    };
  }

  private clampYear(year: number): number {
    return Math.min(this.maxYear, Math.max(this.minYear, year));
  }

  private formatDate(year: number, month: number, day: number): string {
    const monthValue = `${month + 1}`.padStart(2, '0');
    const dayValue = `${day}`.padStart(2, '0');
    return `${year}-${monthValue}-${dayValue}`;
  }

  private toDateString(date: Date): string {
    return this.formatDate(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private playCalendarAnimation(direction: 'slide-next' | 'slide-prev'): void {
    if (this.animationTimeoutId) {
      clearTimeout(this.animationTimeoutId);
    }

    this.calendarAnimation = '';

    setTimeout(() => {
      this.calendarAnimation = direction;
      this.animationTimeoutId = setTimeout(() => {
        this.calendarAnimation = '';
        this.animationTimeoutId = null;
      }, 220);
    }, 0);
  }
}
