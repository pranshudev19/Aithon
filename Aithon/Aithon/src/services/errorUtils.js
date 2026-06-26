// Centralized extraction of readable API error messages.
// Keeps UI consistent when FastAPI/axios return different shapes.
export function extractApiError(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  const detail = data?.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;

  // FastAPI validation errors often come as an array of objects.
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => d?.msg || d?.message || d?.loc?.join('.') || d)
      .filter(Boolean)
      .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)));
    if (parts.length > 0) return parts.join(', ');
  }

  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;

  return fallback;
}

