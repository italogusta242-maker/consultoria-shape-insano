import insanoLogo from "@/assets/insano-logo.svg";

interface InsanoLogoProps {
  size?: number;
  className?: string;
}

const InsanoLogo = ({ size = 40, className = "" }: InsanoLogoProps) => {
  return (
    <img
      src={insanoLogo}
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
