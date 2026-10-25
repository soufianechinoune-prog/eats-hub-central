import { describe, expect, it } from 'vitest';
import { detectReportTypeFromContent, inspectUberCsv, csvRecords, csvFields } from './uberCsvInspection';

describe('Uber report families', () => {
  const cases = [
    ['Id. de la commande,Id. du flux,Nom du restaurant', 'payment_order_level'],
    ["Id. de la commande,Nom du plat/de l'article,Id. de référence du versement", 'payment_item_level'],
    ['Date du versement,Montant total,Nombre de commandes', 'payout_summary'],
    ['Période,Ventes', 'sales_over_time'],
    ["Type d'offre,Audience", 'marketing_campaigns'],
    ['Utilisateurs ayant visité,menu a été consulté', 'conversion_funnel'],
    ['UUID de la commande,Valeur de la note', 'reviews_order'],
    ['Id. de la commande,UUID de la commande,Nom du plat,Valeur de la note', 'reviews_item'],
    ['Ouverture du restaurant à,Disponibilité du menu', 'downtime_report'],
    ["Id. de la commande,Temps d'attente du coursier", 'order_history'],
    ['Id. de la commande,Heure de la commande,Problème avec la commande,Client remboursé', 'inaccurate_orders'],
    ['Jour,Commandes incorrectes', 'order_accuracy_summary'],
    ['Articles incorrects,Nombre,Problème avec le plat', 'item_issues_leaderboard'],
    ['Store name,Status,Operational excellence', 'success_score'],
  ];
  it.each(cases)('detects %s as %s', (header, type) => expect(detectReportTypeFromContent(header)).toBe(type));
  it('prefers article columns over ambiguous payment filename', () => {
    expect(inspectUberCsv("Id. de la commande,Nom du plat/de l'article\n1,Naan", 'common_template.csv').type).toBe('payment_item_level');
  });
  it('scans every restaurant and the complete date range', () => {
    const data = inspectUberCsv("Restaurant,UUID de l'établissement,Date de la commande\nA,aaa,2026-09-01\nB,bbb,2026-09-30", 'order_history.csv');
    expect(data.stores).toEqual([{id:'aaa',name:'A'},{id:'bbb',name:'B'}]);
    expect(data.dateRange).toEqual({start:'2026-09-01',end:'2026-09-30'});
    expect(data.rowCount).toBe(2);
  });
  it('does not misroute unsupported item errors to payments or reviews', () => {
    const data = inspectUberCsv('Restaurant,Id. de la commande,Nom du plat,Problème avec la commande\nA,1,Naan,MISSING_ITEM', 'items_with_errors_local.csv');
    expect(data.type).toBeNull();
    expect(data.unsupported).toBeTruthy();
  });
  it('preserves multiline quoted records and escaped quotes', () => {
    expect(csvRecords('A,B\n1,"hello\nworld"')).toHaveLength(2);
    expect(csvFields('1,"hello, ""world"""')).toEqual(['1','hello, "world"']);
  });
  it('does not count an empty financial export as data', () => {
    expect(inspectUberCsv('Id. de la commande,Id. du flux\n', 'common_template.csv').rowCount).toBe(0);
  });
});