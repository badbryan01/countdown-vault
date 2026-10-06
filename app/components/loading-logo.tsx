import Image from "next/image";

type LoadingLogoProps = {
  variant?: "screen" | "overlay";
  label?: string;
};

export function LoadingLogo({ variant = "screen", label = "Cargando" }: LoadingLogoProps) {
  // Public assets need the repository prefix when deployed to GitHub Pages.
  const src = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/cv-logo.png`;
  return (
    <div className={`loading-logo loading-logo-${variant}`} role="status" aria-label={label} aria-live="polite">
      <Image className="loading-logo-image" src={src} alt="" aria-hidden="true" width={88} height={88} unoptimized preload />
    </div>
  );
}
