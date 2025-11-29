import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
  size?: number;
}

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

// Brand colored versions
export const UberEatsLogo = ({ className, size = 20 }: IconProps) => (
  <div 
    className={cn(
      "inline-flex items-center justify-center rounded-md",
      className
    )}
    style={{ width: size + 4, height: size + 4 }}
  >
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
    >
      <rect width="48" height="48" rx="8" fill="#06C167" />
      <path
        d="M24 10c-7.732 0-14 6.268-14 14s6.268 14 14 14 14-6.268 14-14-6.268-14-14-14zm-2 8h3v9.196l6.062 3.5-1.5 2.598L22 28.804V18z"
        fill="white"
      />
    </svg>
  </div>
);

export const DeliverooLogo = ({ className, size = 20 }: IconProps) => (
  <div 
    className={cn(
      "inline-flex items-center justify-center rounded-md",
      className
    )}
    style={{ width: size + 4, height: size + 4 }}
  >
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
    >
      <rect width="48" height="48" rx="8" fill="#00CCBC" />
      <path
        d="M32.43 8l-5 5v4.904l-5.715-5.714L18.1 15.8l5.714 5.714h-4.904l-5 5v9.486h9.486l5-5v-5.83l5.714 5.715 3.614-3.615L32.01 21.556h4.904l5-5V8H32.43zM16.83 33.17H14v-2.4l1.2-1.2h2.4v2.4l-1.2 1.2h.43zm17.54-17.54l-1.2 1.2h-2.4v-2.4l1.2-1.2h2.4v2.4z"
        fill="white"
      />
    </svg>
  </div>
);
