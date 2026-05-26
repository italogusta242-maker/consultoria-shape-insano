import insanoLogo from "@/assets/insano-logo.svg";
import insanoLogoOrange from "@/assets/insano-logo-orange.svg";
import { useTheme } from "@/hooks/useTheme";

interface InsanoLogoProps {
  size?: number;
  className?: string;
}

const InsanoLogo = ({ size = 40, className = "" }: InsanoLogoProps) => {
  const { theme } = useTheme();
  const src = theme === "light" ? insanoLogoOrange : insanoLogo;

  return (
    <img
      src={src}
      alt="SHAPE INSANO"
      width={size}
      height={size}
      fetchPriority="high"
      loading="eager"
      className={`drop-shadow-none ${className}`}
      style={{ filter: "none" }}
    />
  );
};

export default InsanoLogo;
