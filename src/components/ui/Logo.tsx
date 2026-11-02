import Image from "next/image";

import schoolLogo from "../../../public/sis-logo.png";

type LogoProps = {
  size: number;
  className?: string;
  priority?: boolean;
};

export default function Logo({ size, className, priority = false }: LogoProps) {
  return (
    <Image
      src={schoolLogo}
      alt="SIS school logo"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
