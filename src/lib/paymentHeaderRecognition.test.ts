import { describe, expect, it } from 'vitest';
import { isPaymentHeader, findPaymentHeader } from '../../supabase/functions/parse-payment-report/headerRecognition';

describe('payment report header recognition', () => {
  it('preserves canonical source identity by preferring the actual header over the dictionary', () => {
    expect(findPaymentHeader([
      ["Code alphanumérique de commande tel qu'il apparaît dans Uber Eats Manager", 'Code alphanumérique de référence identifiant le versement'],
      ['Id. de la commande', 'Id. du flux', 'Nom du restaurant'],
      ['', '', 'Tasty Crousty'],
    ])).toBe(1);
  });
  it('recognizes descriptive headers for adjustment-only payouts', () => {
    expect(isPaymentHeader(["Code alphanumérique de commande tel qu'il apparaît dans Uber\u00a0Eats\u00a0Manager",
      'Code alphanumérique de référence identifiant le versement lié à cette commande'])).toBe(true);
  });
  it('does not mistake a restaurant or adjustment row for a header', () => {
    expect(isPaymentHeader(['TASTY CROUSTY PARIS 18', 'Autres frais', '-10.01'])).toBe(false);
  });
});