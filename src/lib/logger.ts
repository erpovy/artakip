/**
 * Yapılandırılmış loglama ve opsiyonel Sentry hata raporlama yardımcısı (Aşama 9).
 */
export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "INFO",
      timestamp: new Date().toISOString(),
      context,
      message,
      ...meta,
    })
  );
}

export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(
    JSON.stringify({
      level: "ERROR",
      timestamp: new Date().toISOString(),
      context,
      error: errMessage,
      stack,
      ...meta,
    })
  );

  // Sentry DSN tanımlıysa HTTP envelope olarak gönder
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    // Arka planda sessizce ilet
    fetch(dsn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, error: errMessage, stack, timestamp: Date.now() }),
    }).catch(() => null);
  }
}
