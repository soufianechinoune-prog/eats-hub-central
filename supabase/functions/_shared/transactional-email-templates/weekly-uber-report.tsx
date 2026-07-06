import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  chainName?: string
  weekLabel?: string
  caBrutTtc?: number
  caNetHt?: number
  ordersCount?: number
  payoutTotal?: number
  downloadUrl?: string
}

const fmtEur = (n?: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n ?? 0)

const fmtInt = (n?: number) =>
  new Intl.NumberFormat('fr-FR').format(n ?? 0)

const Email = ({
  chainName = 'Votre marque',
  weekLabel = 'la semaine passée',
  caBrutTtc = 0,
  caNetHt = 0,
  ordersCount = 0,
  payoutTotal = 0,
  downloadUrl,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      Rapport hebdo Uber Eats — {chainName} — {fmtEur(caBrutTtc)} de CA
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Rapport hebdo Uber Eats</Heading>
        <Text style={subtitle}>
          {chainName} · Semaine du {weekLabel}
        </Text>

        <Section style={kpiGrid}>
          <Section style={kpiCard}>
            <Text style={kpiLabel}>CA brut TTC</Text>
            <Text style={kpiValue}>{fmtEur(caBrutTtc)}</Text>
          </Section>
          <Section style={kpiCard}>
            <Text style={kpiLabel}>CA net HT</Text>
            <Text style={kpiValue}>{fmtEur(caNetHt)}</Text>
          </Section>
          <Section style={kpiCard}>
            <Text style={kpiLabel}>Commandes</Text>
            <Text style={kpiValue}>{fmtInt(ordersCount)}</Text>
          </Section>
          <Section style={kpiCard}>
            <Text style={kpiLabel}>Versement Uber</Text>
            <Text style={kpiValue}>{fmtEur(payoutTotal)}</Text>
          </Section>
        </Section>

        <Hr style={hr} />

        <Text style={paragraph}>
          Le rapport détaillé (semaine réseau, jour par jour, par restaurant, jour × restaurant)
          est disponible au format Excel.
        </Text>

        {downloadUrl && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button style={button} href={downloadUrl}>
              Télécharger le rapport Excel
            </Button>
          </Section>
        )}

        <Text style={footerText}>
          Lien valable 7 jours. Généré automatiquement par CS Delivery Performance.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `Rapport hebdo Uber Eats — ${data?.chainName ?? ''} — ${data?.weekLabel ?? ''}`.trim(),
  displayName: 'Rapport hebdo Uber Eats',
  previewData: {
    chainName: 'Chicken Street',
    weekLabel: '24 au 30 juin 2026',
    caBrutTtc: 152340,
    caNetHt: 98210,
    ordersCount: 4820,
    payoutTotal: 112500,
    downloadUrl: 'https://example.com/download',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700, margin: '0 0 4px' }
const subtitle = { color: '#64748b', fontSize: '14px', margin: '0 0 24px' }
const kpiGrid = { margin: '16px 0' }
const kpiCard = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '8px 0',
}
const kpiLabel = { color: '#64748b', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const kpiValue = { color: '#0f172a', fontSize: '22px', fontWeight: 700, margin: 0 }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const paragraph = { color: '#334155', fontSize: '14px', lineHeight: '22px' }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600,
  display: 'inline-block',
}
const footerText = { color: '#94a3b8', fontSize: '12px', textAlign: 'center' as const, marginTop: '24px' }
