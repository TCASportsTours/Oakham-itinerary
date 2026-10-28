export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="My Fitness 365">
      <rect width="64" height="64" rx="16" fill="#161615" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#2b2b29" strokeWidth="6" />
      <path d="M32 10 A22 22 0 1 1 13.5 43.9" fill="none" stroke="#51cea7" strokeWidth="6" strokeLinecap="round" />
      <text x="32" y="38" textAnchor="middle" fontFamily="Josefin Sans, sans-serif" fontWeight="700" fontStyle="italic" fontSize="17" fill="#fff">365</text>
    </svg>
  )
}
