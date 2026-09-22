import { describe, it, expect } from 'vitest';
import { formatearMensajeError, sanitizarMensajeAlerta } from './error-formatter';

describe('Error Formatter Utility', () => {
  it('debe extraer el mensaje limpio cuando viene envuelto en formato Spring Boot 400 BAD_REQUEST', () => {
    const raw = '400 BAD_REQUEST "El nombre de la seccion ya esta registrado en este periodo"';
    const formateado = sanitizarMensajeAlerta(raw);
    expect(formateado).toBe('El nombre de la seccion ya esta registrado en este periodo.');
  });

  it('no debe mostrar "400 BAD_REQUEST" si el mensaje es solo ese codigo tecnico', () => {
    const errorObj = {
      status: 400,
      error: { mensaje: '400 BAD_REQUEST' }
    };
    const formateado = formatearMensajeError(errorObj, 'No se pudo registrar la seccion.');
    expect(formateado).not.toContain('BAD_REQUEST');
    expect(formateado).toBe('No se pudo registrar la seccion.');
  });

  it('debe filtrar errores Http failure response y dar mensaje comprensible', () => {
    const errorObj = {
      status: 0,
      message: 'Http failure response for http://localhost:8085/api/secciones: 0 Unknown Error'
    };
    const formateado = formatearMensajeError(errorObj);
    expect(formateado).not.toContain('Http failure');
    expect(formateado).toContain('No se pudo conectar con el servidor');
  });

  it('debe manejar codigo 403 con mensaje de permisos', () => {
    const errorObj = { status: 403, error: { message: 'Forbidden' } };
    const formateado = formatearMensajeError(errorObj);
    expect(formateado).toBe('No tienes permisos suficientes para realizar esta acción.');
  });

  it('debe manejar codigo 404 con mensaje amigable', () => {
    const errorObj = { status: 404, error: { message: 'Not Found' } };
    const formateado = formatearMensajeError(errorObj);
    expect(formateado).toBe('El registro o recurso solicitado no fue encontrado o ya no está disponible.');
  });

  it('debe traducir violaciones de constraint SQL a mensaje de duplicidad', () => {
    const errorObj = {
      status: 500,
      error: { message: 'could not execute statement; SQL [n/a]; constraint [uk_codigo_alumno]' }
    };
    const formateado = formatearMensajeError(errorObj);
    expect(formateado).toContain('Ya existe un registro con información duplicada');
  });

  it('debe preservar mensajes claros de negocio del backend', () => {
    const errorObj = {
      status: 400,
      error: { mensaje: 'La capacidad maxima no puede ser menor a los alumnos matriculados.' }
    };
    const formateado = formatearMensajeError(errorObj);
    expect(formateado).toBe('La capacidad maxima no puede ser menor a los alumnos matriculados.');
  });
});
