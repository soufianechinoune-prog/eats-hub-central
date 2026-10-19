Chataigne: les correspondances restaurants validées manuellement (match_method=manual) priment sur la détection auto aux syncs, pour ne pas les écraser.
Prix sur place: source de vérité = instore_restaurant_prices via RPC get_instore_price_matrix; les grilles par version (V2/V4) ne sont plus affichées, le terrain diverge des versions théoriques.
Navigation par canal (Vue réseau, Live, Uber/Deliveroo/Caisse/Dishop/Chataigne) dans la sidebar gauche via OverviewChannelSidebar; Overview lit ?channel= dans l'URL — une seule sidebar, pas de colonne en double.
Prix & Tarifs réutilise le sélecteur partagé d'AnalyticsHeader sans période: 1 restaurant = prix éditable face à la médiane réseau, plusieurs = agrégat, aucun = vue réseau — même périmètre entre vues.
Prix par canal saisis/importés dans channel_restaurant_prices (Uber Eats, Deliveroo, Dishop, Châtaigne); instore_restaurant_prices reste la caisse. RPC isolent l'enseigne; ne jamais déduire un tarif de vente d'une commande.
Identité enseigne (nom + logo) dans le sélecteur de chaîne de la sidebar; en-tête principal neutre, pour ne pas répéter la marque.
Vue réseau: NetworkRevenueHero + NetworkChannelCards + NetworkComparisonTable; N-1 par canal apparaît seulement sous la barre du hero, selon le périmètre choisi.
Bascule « Réseau complet / Périmètre constant » dans l'en-tête de NetworkRevenueHero (libellé à gauche, switch en haut à droite de la carte), pilote analyticsCtx.comparisonScope; les tableaux affichent un badge d'état, jamais un doublon dans Filtres.
Date d'ouverture effective centralisée dans src/lib/restaurantActivityFilter.ts (getEffectiveOpeningDate): manuelle prioritaire, sinon restaurants.first_activity_date (1re vente caisse Splash, repli Uber/Deliveroo) — un resto sans date n'est plus réputé ouvert depuis toujours, sinon le périmètre constant est faussé.

- Caisse Splash inclut les commandes Châtaigne (pas de tag côté Splash) : soustraire le CA Châtaigne du CA caisse dans toutes les vues réseau (hook useNetworkDailyRevenue + Overview cashNetTotal/cashNetByRestaurant) jusquà ce que Splash tague les commandes.
- Vue d'ensemble : CA Uber/Deliveroo lu dans la caisse Splash (référence réseau) ; repli API par canal si Splash remonte 0 € (badge « API »), la caisse reprend la main dès que le flux remonte. Onglets canal : API pour la rentabilité.

- Chataigne daily analytics are rebuilt server-side from completed orders over complete Paris calendar days via a service-only RPC; never overwrite a day from a rolling partial timestamp window, so nightly refreshes preserve early orders.
 - Restaurant performance uses one scoped server-side RPC over orders for current and previous Paris periods, so revenue, clients, delivery, discounts and cancellations share consistent boundaries without browser pagination.
- Chataigne revenue, growth and referral calendar charts share chart_notes and scope filtering; retain ISO bucket dates and named Y axes when rendering markers so events remain reciprocal across day/week/month views.

- Calendar event ranges use an inclusive nullable chart_notes.end_date, overlap-aware queries, and a shared drag-selection hook so all annotated Chataigne charts stay reciprocal across granularities.
- Annotated Chataigne charts use ChartNoteLegend for visible titles, dates and presentation-only visibility controls; hiding annotations must never change stored notes or analytics.

- Mijo (ai-advisor) answers history questions via Anthropic tool use backed by mijo_* SQL functions; chain_id is injected server-side, never a tool parameter, and context KPIs use the same functions so numbers match.
- Mijo conversation policy is shared with regression tests; automatic titles use a separate audited server request without quota increments, so title costs cannot count as user questions.
- Mijo uses a flex-height floating window and the shared resizable panels for its conversation list; expanding the window must preserve the mounted chat and its state.
