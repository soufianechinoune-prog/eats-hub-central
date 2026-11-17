export interface Establishment {
  siret: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  etat_administratif?: string;
  activite_principale?: string;
  date_creation?: string;
}

export interface Company {
  siren: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  date_creation?: string;
  siege?: Establishment;
  matching_etablissements?: Establishment[];
  dirigeants?: { prenoms?: string; prenom?: string; nom?: string; denomination?: string }[];
}

export function mapCompanySearch(results: Company[], siret: string) {
  const company = results.find((item) => item.siren === siret.slice(0, 9));
  const establishment = company?.siege?.siret === siret
    ? company.siege
    : company?.matching_etablissements?.find((item) => item.siret === siret);
  // A matching company alone does not prove that the requested establishment exists.
  if (!company || !establishment) return { valid: false };
  const address = establishment.adresse || "";
  const parsed = address.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
  const director = company.dirigeants?.[0];
  return {
    valid: true,
    denomination: company.nom_raison_sociale || company.nom_complet || "Entreprise",
    adresse: address || undefined,
    etat: establishment.etat_administratif === "A" ? "Actif"
      : establishment.etat_administratif === "F" ? "Fermé" : undefined,
    rue: parsed?.[1]?.trim() || undefined,
    codePostal: establishment.code_postal || parsed?.[2] || undefined,
    ville: establishment.libelle_commune || parsed?.[3]?.trim() || undefined,
    siren: company.siren,
    activite: establishment.activite_principale,
    formeJuridique: company.nature_juridique,
    dateCreation: company.date_creation || establishment.date_creation,
    dirigeant: director ? {
      prenom: director.prenoms || director.prenom || undefined,
      nom: director.nom || director.denomination || undefined,
    } : null,
  };
}