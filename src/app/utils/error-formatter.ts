/**
 * Utilidades para formatear y sanitizar mensajes de error del backend.
 * Evita la exposición de trazas tecnicas como "400 BAD_REQUEST",
 * errores SQL o fallas HTTP crudas, garantizando mensajes claros para el usuario.
 */

const ERRORES_ESTATUS_HTTP: Record<number, string> = {
  0: 'No se pudo conectar con el servidor. Revisa tu conexion a internet o verifica que el servicio este disponible.',
  400: 'Los datos enviados no son validos o estan incompletos. Revisa la informacion ingresada.',
  401: 'Tu sesion ha expirado o no cuentas con autorizacion. Inicia sesion nuevamente.',
  403: 'No tienes permisos suficientes para realizar esta accion.',
  404: 'El registro o recurso solicitado no fue encontrado o ya no esta disponible.',
  409: 'Ya existe un registro con esta informacion o la operacion genera un conflicto.',
  422: 'No se pudo procesar la solicitud con los datos proporcionados.',
  500: 'Ocurrio un problema interno en el servidor. Por favor, intenta nuevamente en unos momentos.',
  502: 'El servidor no se encuentra disponible en este momento.',
  503: 'El servicio esta temporalmente fuera de linea por mantenimiento.',
  504: 'El servidor tardo demasiado tiempo en responder. Intenta nuevamente.'
};

const PATRONES_TECNICOS: RegExp[] = [
  /^\s*\d{3}\s+[A-Z_]+\s*$/i, // "400 BAD_REQUEST", "500 INTERNAL_SERVER_ERROR"
  /^(bad request|internal server error|not found|unauthorized|forbidden|conflict)$/i,
  /Http failure response for/i,
  /could not execute statement/i,
  /org\.springframework\./i,
  /org\.hibernate\./i,
  /DataIntegrityViolationException/i,
  /ConstraintViolationException/i,
  /NullPointerException/i,
  /JSON parse error/i,
  /Validation failed for/i,
  /Cannot deserialize/i,
  /SQLGrammarException/i,
  /JDBC exception/i,
  /status code \d{3}/i
];

/**
 * Limpia y normaliza una cadena de texto para presentacion al usuario.
 */
function normalizarTexto(texto: string): string {
  let limpio = texto
    .replace(/^["'\s]+|["'\s]+$/g, '') // quita comillas externas y espacios
    .replace(/\\"/g, '"') // desescapa comillas
    .trim();

  if (!limpio) {
    return '';
  }

  // Asegurar que inicie con mayuscula
  limpio = limpio.charAt(0).toUpperCase() + limpio.slice(1);

  // Asegurar punto final si no tiene signo de puntuacion
  if (!/[.!?]$/.test(limpio)) {
    limpio += '.';
  }

  return limpio;
}

/**
 * Determina si un texto corresponde a una traza tecnica no apta para el usuario final.
 */
function esTextoTecnico(texto: string): boolean {
  if (!texto || texto.trim().length === 0) {
    return true;
  }
  return PATRONES_TECNICOS.some((regex) => regex.test(texto));
}

/**
 * Extrae el mensaje humano si el texto viene envuelto en formato Spring Boot:
 * Ej: 400 BAD_REQUEST "El nombre de la seccion ya existe"
 */
function extraerMensajeSpring(texto: string): string | null {
  const patronConComillas = /^\s*\d{3}\s+[A-Z_]+(?:\s*["':]\s*|\s+)([\s\S]*?)["']?\s*$/i;
  const match = texto.match(patronConComillas);
  if (match && match[1]) {
    const candidato = match[1].replace(/^["']+|["']+$/g, '').trim();
    if (candidato && !esTextoTecnico(candidato)) {
      return candidato;
    }
  }
  return null;
}

/**
 * Sanitiza cualquier texto que vaya a mostrarse en una alerta,
 * filtrando prefijos como "400 BAD_REQUEST" y errores de infraestructura.
 */
export function sanitizarMensajeAlerta(
  mensaje: string | null | undefined,
  fallback: string = 'Ocurrio un problema al procesar la solicitud. Intenta nuevamente.'
): string {
  if (!mensaje || typeof mensaje !== 'string') {
    return fallback;
  }

  const texto = mensaje.trim();
  if (!texto) {
    return fallback;
  }

  // Intentar extraer mensaje util dentro de prefijo tipo 400 BAD_REQUEST "..."
  const extraido = extraerMensajeSpring(texto);
  if (extraido) {
    return normalizarTexto(extraido);
  }

  // Si es un error de conflicto de base de datos conocido
  if (/could not execute statement|DataIntegrityViolation|duplicate key|unique constraint/i.test(texto)) {
    return 'Ya existe un registro con informacion duplicada (por ejemplo nombre, codigo, DNI o correo en uso).';
  }

  // Si es un error de conexion HTTP
  if (/Http failure response/i.test(texto)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexion o verifica que el servicio este activo.';
  }

  // Si es puramente un codigo o texto tecnico
  if (esTextoTecnico(texto)) {
    return fallback;
  }

  return normalizarTexto(texto);
}

/**
 * Recibe cualquier objeto de error (HttpErrorResponse, Error, string, etc.)
 * y devuelve un mensaje comprensible, en español y libre de codigos tecnicos.
 */
export function formatearMensajeError(
  error: any,
  fallbackDefault: string = 'Ocurrio un problema al procesar la solicitud.'
): string {
  if (!error) {
    return fallbackDefault;
  }

  // 1. Si es un string simple
  if (typeof error === 'string') {
    return sanitizarMensajeAlerta(error, fallbackDefault);
  }

  const status: number | undefined = error.status;

  // 2. Extraer candidato desde el cuerpo de respuesta
  let candidato = '';

  if (typeof error.error === 'string') {
    candidato = error.error;
  } else if (error.error && typeof error.error === 'object') {
    candidato =
      error.error.mensaje ||
      error.error.message ||
      (typeof error.error.error === 'string' ? error.error.error : '') ||
      '';

    // Si viene una lista de errores de validacion Spring (FieldErrors)
    if (!candidato && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
      const primerError = error.error.errors[0];
      candidato = primerError.defaultMessage || primerError.message || '';
    }
  }

  if (!candidato && error.message) {
    candidato = error.message;
  }

  // 3. Si el candidato contiene un mensaje de negocio humano o conflicto de BD conocido
  if (candidato) {
    if (/could not execute statement|DataIntegrityViolation|duplicate key|unique constraint|foreign key/i.test(candidato)) {
      return 'Ya existe un registro con informacion duplicada (por ejemplo nombre, codigo, DNI o correo en uso).';
    }

    const extraido = extraerMensajeSpring(candidato);
    if (extraido) {
      return normalizarTexto(extraido);
    }

    if (!esTextoTecnico(candidato)) {
      return normalizarTexto(candidato);
    }
  }

  // 4. Si el candidato es puramente tecnico o no existe, resolver por codigo HTTP
  if (status !== undefined && ERRORES_ESTATUS_HTTP[status]) {
    // Si tenemos un fallback especifico provisto por el componente (ej: "No se pudo registrar la seccion"),
    // y el estatus es 400 (Bad Request genérico), combinamos con contexto si es oportuno
    if (status === 400 && fallbackDefault && fallbackDefault !== 'Ocurrio un problema al procesar la solicitud.') {
      return normalizarTexto(fallbackDefault);
    }
    return ERRORES_ESTATUS_HTTP[status];
  }

  return normalizarTexto(fallbackDefault);
}
