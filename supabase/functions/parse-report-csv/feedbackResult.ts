export interface FeedbackResult {
  success?: boolean;
  stats?: { errors?: number; inserted?: number };
}

export function feedbackImportFailed(error: unknown, result: FeedbackResult | null | undefined): boolean {
  return Boolean(error) || result?.success === false || (result?.stats?.errors ?? 0) > 0;
}