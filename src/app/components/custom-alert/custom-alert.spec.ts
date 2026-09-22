import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomAlertComponent } from './custom-alert';

describe('CustomAlertComponent', () => {
  let fixture: ComponentFixture<CustomAlertComponent>;
  let component: CustomAlertComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomAlertComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CustomAlertComponent);
    component = fixture.componentInstance;
  });

  it('debe crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debe sanitizar automaticamente mensajes tecnicos tipo 400 BAD_REQUEST', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('message', '400 BAD_REQUEST "La seccion ya existe"');
    fixture.detectChanges();

    expect(component.displayMessage()).toBe('La seccion ya existe.');
  });

  it('debe asignar "Entendido" como texto de confirmacion por defecto si viene nulo', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('confirmText', null);
    fixture.detectChanges();

    expect(component.effectiveConfirmText()).toBe('Entendido');
  });

  it('debe emitir dismiss al presionar el boton de cerrar (X)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const dismissSpy = vi.fn();
    component.dismiss.subscribe(dismissSpy);

    const closeBtn = fixture.nativeElement.querySelector('.custom-alert-close') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();

    expect(dismissSpy).toHaveBeenCalled();
  });

  it('debe emitir confirm y dismiss al presionar Entendido cuando no hay boton cancelar', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const confirmSpy = vi.fn();
    const dismissSpy = vi.fn();
    component.confirm.subscribe(confirmSpy);
    component.dismiss.subscribe(dismissSpy);

    component.onConfirm();

    expect(confirmSpy).toHaveBeenCalled();
    expect(dismissSpy).toHaveBeenCalled();
  });
});
