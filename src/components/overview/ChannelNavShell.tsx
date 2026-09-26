import { ReactNode } from "react";

/**
 * La navigation par canal vit désormais dans la barre latérale principale (gauche).
 * Cette enveloppe est conservée pour compatibilité des pages : simple conteneur.
 */
export function ChannelNavShell({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
