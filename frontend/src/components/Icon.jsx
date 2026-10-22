const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  baby: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-6 18c0-3.9 2.7-7 6-7s6 3.1 6 7M10 7h.01M14 7h.01M10.5 9a2 2 0 0 0 3 0',
  heart: 'M12 20s-7-4.4-9.2-8.6C1.4 8.6 3 5 6.5 5c2 0 3.5 1.2 5.5 3.3C14 6.2 15.5 5 17.5 5 21 5 22.6 8.6 21.2 11.4 19 15.6 12 20 12 20z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9c0-4 3.6-7 8-7s8 3 8 7',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  check: 'M5 12.5 10 17 19 7',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  foot: 'M8 3c2 0 3 2 3 5s-1 6-3 6-3-3-3-6 1-5 3-5zM7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM16 7c1.7 0 2.5 1.6 2.5 4S17.7 16 16 16s-2.5-2.6-2.5-5S14.3 7 16 7zM15 19a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 0 0-3.4 0z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  scale: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 9a4 4 0 0 1 8 0M12 9l1.5-2',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  chevron: 'M9 5l7 7-7 7',
}

export default function Icon({ name, size = 22, stroke = 2, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
