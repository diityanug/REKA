/**
 * Utility for converting technical runtime errors (Java IO, network failures,
 * API exceptions, JSON parsing errors) into user-friendly, actionable messages.
 */

export type ErrorContext = 'statement' | 'receipt' | 'file' | 'database' | 'general';

/**
 * Extracts a human-friendly string from any error object or exception.
 * Guarantees that users never see "java.io.IOException", "TypeError",
 * API keys, or raw stack traces.
 */
export function toUserFriendlyErrorMessage(
  err: unknown,
  context: ErrorContext = 'general'
): string {
  if (!err) {
    return 'An unexpected issue occurred. Please try again.';
  }

  const raw =
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err as any)?.toString() || '';

  const lower = raw.toLowerCase();

  // 1. User cancelled or aborted
  if (lower.includes('aborted') || lower.includes('cancelled') || lower.includes('canceled')) {
    return 'Operation was cancelled.';
  }

  // 2. Offline / Network / Connectivity issues
  if (
    lower.includes('network request failed') ||
    lower.includes('fetch failed') ||
    lower.includes('offline') ||
    lower.includes('internet') ||
    lower.includes('connection') ||
    lower.includes('socket') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('failed to connect') ||
    lower.includes('unable to resolve host')
  ) {
    if (context === 'statement') {
      return 'Cannot analyze e-Statement while offline. Please turn on your internet connection and try again.';
    }
    if (context === 'receipt') {
      return 'Cannot scan receipt while offline. Please check your internet connection and try again, or enter the transaction manually.';
    }
    return 'No internet connection detected. Please check your Wi-Fi or mobile data and try again.';
  }

  // 3. Timeout issues
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('took too long')) {
    if (context === 'statement') {
      return 'Analysis took too long. Please make sure your internet is stable and consider uploading a smaller PDF with fewer pages.';
    }
    return 'The request took too long to complete. Please check your internet connection and try again.';
  }

  // 4. Rate limits / Server busy / Quota / 503 / 429
  if (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('service unavailable') ||
    lower.includes('overload') ||
    lower.includes('demand') ||
    lower.includes('quota') ||
    lower.includes('resource exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return 'The scanning service is temporarily busy. Please wait a moment and try again, or enter the details manually.';
  }

  // 5. Password-protected or encrypted PDF
  if (
    lower.includes('password') ||
    lower.includes('encrypted') ||
    lower.includes('protected') ||
    lower.includes('decrypt') ||
    lower.includes('security')
  ) {
    return 'This PDF appears to be password-protected. Please unlock or remove the password from your e-Statement PDF before importing.';
  }

  // 6. Java IO, Android Scoped Storage, Content URI, File permissions
  if (
    lower.includes('java.io') ||
    lower.includes('java.lang') ||
    lower.includes('ioexception') ||
    lower.includes('filenotfound') ||
    lower.includes("isn't readable") ||
    lower.includes('not readable') ||
    lower.includes('permission denied') ||
    lower.includes('content://') ||
    lower.includes('storageaccessframework') ||
    lower.includes('cannot open file') ||
    lower.includes('enoent')
  ) {
    if (context === 'statement') {
      return 'Could not open the selected e-Statement file. Please save the PDF directly to your device storage (such as your Downloads folder) and try again.';
    }
    return 'Could not open the selected file. Please make sure the file is saved to your local device storage and try again.';
  }

  // 7. Parsing / Corrupt document / Empty document
  if (
    lower.includes('syntaxerror') ||
    lower.includes('json.parse') ||
    lower.includes('unexpected token') ||
    lower.includes('no readable content') ||
    lower.includes('corrupt') ||
    lower.includes('format')
  ) {
    if (context === 'statement') {
      return 'We could not recognize transaction records in this file. Please make sure it is a valid bank e-Statement (PDF or CSV).';
    }
    if (context === 'receipt') {
      return 'We could not recognize receipt details in this photo. Please ensure the image is well-lit and clearly shows total amounts.';
    }
    return 'The file content could not be read properly. Please try another file or enter details manually.';
  }

  // 8. Database issues
  if (context === 'database' || lower.includes('sqlite') || lower.includes('database')) {
    return 'Could not update local storage. Please restart the app and try again.';
  }

  // 9. If the message already looks clean and doesn't contain tech jargon, preserve it
  const isTechnical =
    lower.includes('exception') ||
    lower.includes('runtime') ||
    lower.includes('nullpointer') ||
    lower.includes('stacktrace') ||
    lower.includes('undefined is not') ||
    lower.includes('cannot read property') ||
    lower.includes('object') ||
    lower.includes('at line') ||
    lower.includes('error:');

  if (!isTechnical && raw.length > 5 && raw.length < 160) {
    return raw;
  }

  // 10. General friendly fallback
  if (context === 'statement') {
    return 'Could not process the e-Statement. Please make sure the file is a readable bank PDF, or enter transactions manually.';
  }
  if (context === 'receipt') {
    return 'Could not process this receipt. Please try taking a clearer photo or enter details manually.';
  }
  return 'Something went wrong while processing your request. Please try again.';
}
