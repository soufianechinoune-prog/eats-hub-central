import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe } from "lucide-react";

const PrivacyPolicy = () => {
  const [language, setLanguage] = useState<"fr" | "en">("fr");

  useEffect(() => {
    document.title = language === "fr" 
      ? "Politique de Confidentialité — CS Performance"
      : "Privacy Policy — CS Performance";
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === "fr" ? "en" : "fr");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {language === "fr" ? "Retour à l'accueil" : "Back to Home"}
            </Button>
          </Link>
          <Button variant="outline" onClick={toggleLanguage} className="gap-2">
            <Globe className="w-4 h-4" />
            {language === "fr" ? "EN" : "FR"}
          </Button>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          {language === "fr" ? <FrenchContent /> : <EnglishContent />}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <Link to="/">
            <Button variant="link">
              {language === "fr" ? "Retour à l'accueil" : "Back to Home"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

const FrenchContent = () => (
  <>
    <h1 className="text-4xl font-bold text-foreground mb-2">
      Politique de Confidentialité — CS Performance
    </h1>
    <p className="text-sm text-muted-foreground mb-8">
      (Version française – conforme RGPD & intégration API Uber Eats)
    </p>
    <p className="text-sm text-muted-foreground mb-8">
      Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
    </p>

    <div className="space-y-6 text-foreground">
      <p>
        CS Performance (« le Service ») est une plateforme d'analyse et de gestion destinée aux restaurants, 
        opérée par Opineo. La présente Politique de Confidentialité explique comment nous collectons, 
        utilisons, stockons et protégeons les données lorsque les restaurateurs connectent leur compte 
        Uber Eats à notre plateforme.
      </p>
      <p>
        En utilisant le Service ou en connectant un compte Uber Eats, vous acceptez les pratiques décrites ci-dessous.
      </p>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">1. Données que nous collectons</h2>
        
        <h3 className="text-xl font-semibold text-foreground mb-3">1.1 Données fournies directement par l'utilisateur</h3>
        <p className="mb-2">Lors de la création ou de la connexion d'un compte, nous pouvons collecter :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Informations professionnelles (nom du restaurant, adresse, contacts)</li>
          <li>Informations d'identification (email, rôle, permissions)</li>
          <li>Jetons d'authentification nécessaires à la connexion aux API Uber Eats</li>
        </ul>

        <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">1.2 Données récupérées via les APIs Uber Eats</h3>
        <p className="mb-2">Avec votre autorisation, nous pouvons traiter :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Données de commandes (ID, détails, horaires, statuts)</li>
          <li>Informations du magasin (menus, prix, horaires d'ouverture)</li>
          <li>Données financières (revenus, frais, paiements)</li>
          <li>Indicateurs de performance (temps de préparation, taux d'annulation, etc.)</li>
        </ul>
        <p className="mt-2">
          Nous ne collectons jamais de données personnelles des clients finaux, sauf si cela est 
          explicitement autorisé par les politiques Uber.
        </p>

        <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">1.3 Données techniques</h3>
        <p className="mb-2">Nous pouvons collecter :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Logs techniques</li>
          <li>Métadonnées de navigation/appareil</li>
          <li>Événements liés à la sécurité</li>
        </ul>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">2. Utilisation des données</h2>
        <p className="mb-2">Nous utilisons les données pour :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Afficher tableaux de bord et analyses en temps réel</li>
          <li>Améliorer les performances opérationnelles des restaurants</li>
          <li>Synchroniser menus, informations de magasin et statistiques</li>
          <li>Produire rapports, insights, notifications</li>
          <li>Assurer sécurité, disponibilité, monitoring du service</li>
        </ul>
        <p className="mt-4 font-semibold">Nous ne vendons pas vos données.</p>
        <p className="font-semibold">Nous n'utilisons pas les données à des fins non autorisées.</p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">3. Base juridique du traitement (RGPD)</h2>
        <p className="mb-2">Nous traitons les données sur les bases légales suivantes :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Nécessité contractuelle (fourniture du Service)</li>
          <li>Intérêt légitime (sécurité, amélioration du service)</li>
          <li>Consentement explicite (autorisation API Uber Eats)</li>
        </ul>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">4. Partage des données</h2>
        <p className="mb-2">Nous pouvons partager des données uniquement avec :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Uber (communication API)</li>
          <li>Prestataires techniques (hébergement, monitoring, analytics)</li>
          <li>Autorités (uniquement si exigé par la loi)</li>
        </ul>
        <p className="mt-4 font-semibold">Aucun partage commercial ou revente.</p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">5. Sécurité et stockage</h2>
        <p className="mb-2">Nous appliquons des mesures strictes :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Chiffrement des données</li>
          <li>Contrôle d'accès</li>
          <li>Stockage sécurisé</li>
          <li>Journalisation des accès</li>
        </ul>
        <p className="mt-4">
          Les données sont hébergées sur des infrastructures conformes UE (Vercel, Supabase, AWS).
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">6. Durée de conservation</h2>
        <p className="mb-2">Nous conservons les données :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Tant que le compte reste actif</li>
          <li>Ou selon les obligations légales applicables</li>
        </ul>
        <p className="mt-4">
          L'utilisateur peut demander suppression ou anonymisation à tout moment.
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">7. Vos droits (RGPD)</h2>
        <p className="mb-2">Vous pouvez demander :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Accès</li>
          <li>Rectification</li>
          <li>Suppression</li>
          <li>Limitation</li>
          <li>Portabilité</li>
        </ul>
        <p className="mt-4">
          Pour exercer vos droits : <a href="mailto:contact@opineo.io" className="text-primary hover:underline">contact@opineo.io</a>
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">8. Services tiers</h2>
        <p className="mb-2">Le Service intègre :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Uber Eats APIs</li>
        </ul>
        <p className="mt-4">
          L'accès est strictement limité aux scopes autorisés par Uber et validés par l'utilisateur.
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">9. Modifications de cette Politique</h2>
        <p>
          Nous pouvons mettre à jour cette Politique. Les modifications seront publiées à :
        </p>
        <p className="mt-2">
          <a href="https://eats-hub-central.lovable.app/privacy-policy" className="text-primary hover:underline">
            https://eats-hub-central.lovable.app/privacy-policy
          </a>
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">10. Contact</h2>
        <p>Opineo</p>
        <p>Email : <a href="mailto:contact@opineo.io" className="text-primary hover:underline">contact@opineo.io</a></p>
      </section>
    </div>
  </>
);

const EnglishContent = () => (
  <>
    <h1 className="text-4xl font-bold text-foreground mb-2">
      Privacy Policy — CS Performance
    </h1>
    <p className="text-sm text-muted-foreground mb-8">
      (English version – GDPR compliant & Uber Eats API integration)
    </p>
    <p className="text-sm text-muted-foreground mb-8">
      Last updated: {new Date().toLocaleDateString("en-US")}
    </p>

    <div className="space-y-6 text-foreground">
      <p>
        CS Performance ("the Service") is an analysis and management platform for restaurants, 
        operated by Opineo. This Privacy Policy explains how we collect, use, store and protect 
        data when restaurant owners connect their Uber Eats account to our platform.
      </p>
      <p>
        By using the Service or connecting an Uber Eats account, you accept the practices described below.
      </p>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">1. Data We Collect</h2>
        
        <h3 className="text-xl font-semibold text-foreground mb-3">1.1 Data Provided Directly by Users</h3>
        <p className="mb-2">When creating or connecting an account, we may collect:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Business information (restaurant name, address, contacts)</li>
          <li>Identification information (email, role, permissions)</li>
          <li>Authentication tokens required to connect to Uber Eats APIs</li>
        </ul>

        <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">1.2 Data Retrieved via Uber Eats APIs</h3>
        <p className="mb-2">With your authorization, we may process:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Order data (IDs, details, schedules, statuses)</li>
          <li>Store information (menus, prices, opening hours)</li>
          <li>Financial data (revenue, fees, payments)</li>
          <li>Performance indicators (preparation time, cancellation rate, etc.)</li>
        </ul>
        <p className="mt-2">
          We never collect personal data from end customers unless explicitly authorized by Uber policies.
        </p>

        <h3 className="text-xl font-semibold text-foreground mb-3 mt-6">1.3 Technical Data</h3>
        <p className="mb-2">We may collect:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Technical logs</li>
          <li>Navigation/device metadata</li>
          <li>Security-related events</li>
        </ul>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">2. Data Usage</h2>
        <p className="mb-2">We use data to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Display real-time dashboards and analytics</li>
          <li>Improve restaurant operational performance</li>
          <li>Synchronize menus, store information and statistics</li>
          <li>Generate reports, insights, notifications</li>
          <li>Ensure security, availability, service monitoring</li>
        </ul>
        <p className="mt-4 font-semibold">We do not sell your data.</p>
        <p className="font-semibold">We do not use data for unauthorized purposes.</p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">3. Legal Basis for Processing (GDPR)</h2>
        <p className="mb-2">We process data on the following legal bases:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Contractual necessity (Service provision)</li>
          <li>Legitimate interest (security, service improvement)</li>
          <li>Explicit consent (Uber Eats API authorization)</li>
        </ul>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Sharing</h2>
        <p className="mb-2">We may share data only with:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Uber (API communication)</li>
          <li>Technical providers (hosting, monitoring, analytics)</li>
          <li>Authorities (only if required by law)</li>
        </ul>
        <p className="mt-4 font-semibold">No commercial sharing or resale.</p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">5. Security and Storage</h2>
        <p className="mb-2">We apply strict measures:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Data encryption</li>
          <li>Access control</li>
          <li>Secure storage</li>
          <li>Access logging</li>
        </ul>
        <p className="mt-4">
          Data is hosted on EU-compliant infrastructure (Vercel, Supabase, AWS).
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">6. Data Retention</h2>
        <p className="mb-2">We retain data:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>As long as the account remains active</li>
          <li>Or according to applicable legal obligations</li>
        </ul>
        <p className="mt-4">
          Users can request deletion or anonymization at any time.
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">7. Your Rights (GDPR)</h2>
        <p className="mb-2">You can request:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Access</li>
          <li>Rectification</li>
          <li>Deletion</li>
          <li>Limitation</li>
          <li>Portability</li>
        </ul>
        <p className="mt-4">
          To exercise your rights: <a href="mailto:contact@opineo.io" className="text-primary hover:underline">contact@opineo.io</a>
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">8. Third-Party Services</h2>
        <p className="mb-2">The Service integrates:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Uber Eats APIs</li>
        </ul>
        <p className="mt-4">
          Access is strictly limited to scopes authorized by Uber and validated by the user.
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">9. Changes to this Policy</h2>
        <p>
          We may update this Policy. Changes will be published at:
        </p>
        <p className="mt-2">
          <a href="https://eats-hub-central.lovable.app/privacy-policy" className="text-primary hover:underline">
            https://eats-hub-central.lovable.app/privacy-policy
          </a>
        </p>
      </section>

      <hr className="my-8 border-border" />

      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">10. Contact</h2>
        <p>Opineo</p>
        <p>Email: <a href="mailto:contact@opineo.io" className="text-primary hover:underline">contact@opineo.io</a></p>
      </section>
    </div>
  </>
);

export default PrivacyPolicy;