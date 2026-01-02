import Image from "next/image"

interface SolanaLogoProps {
  className?: string
  size?: number
  gray?: boolean
}

export function SolanaLogo({ className = "", size = 16, gray = true }: SolanaLogoProps) {
  return (
    <Image
      src="/sol-logo.png"
      alt="SOL"
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={gray ? { filter: "grayscale(100%)", opacity: 0.7 } : {}}
    />
  )
}

