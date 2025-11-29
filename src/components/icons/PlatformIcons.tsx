import { cn } from "@/lib/utils";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";

interface IconProps {
  className?: string;
  size?: number;
}

export const UberEatsLogo = ({ className, size = 20 }: IconProps) => (
  <img
    src={uberEatsLogo}
    alt="Uber Eats"
    width={size}
    height={size}
    className={cn("inline-block rounded-sm object-contain", className)}
  />
);

export const DeliverooLogo = ({ className, size = 20 }: IconProps) => (
  <img
    src={deliverooLogo}
    alt="Deliveroo"
    width={size}
    height={size}
    className={cn("inline-block object-contain", className)}
  />
);

// SVG versions as fallback
export const UberEatsIcon = ({ className, size = 20 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={cn("inline-block", className)}
    fill="currentColor"
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1.5 5v5.268l4.5 2.598-.75 1.299L9 13.232V7h1.5z" />
  </svg>
);

export const DeliverooIcon = ({ className, size = 20 }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={cn("inline-block", className)}
    fill="currentColor"
  >
    <path d="M16.861 0l-4.166 4.166V8.25L7.916 3.47 4.25 7.136l4.78 4.78H4.166L0 16.083V24h7.917l4.166-4.166v-4.863l4.78 4.779 3.666-3.666-4.779-4.779h4.084L24 7.138V0h-7.139zM5.695 20.305H3.694v-2.001l1.001-1.001h2.001v2.001l-1.001 1.001zm14.611-14.61l-1.001 1.001h-2.001V4.695l1.001-1.001h2.001v2.001z" />
  </svg>
);