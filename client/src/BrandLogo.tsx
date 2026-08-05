type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: 28,
  md: 56,
  lg: 96,
};

export function BrandLogo({ className = "", size = "md" }: BrandLogoProps) {
  const px = sizes[size];
  return (
    <img
      src="/yin-yang.png"
      alt=""
      width={px}
      height={px}
      className={`brand-logo brand-logo-${size} ${className}`.trim()}
      decoding="async"
    />
  );
}
