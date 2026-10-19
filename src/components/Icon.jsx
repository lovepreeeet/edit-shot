const PATHS = {
  select: <path d="M4 4l7 17 2.5-7.5L21 11z" />,
  rect: <rect x="3" y="5" width="18" height="14" rx="1.5" />,
  ellipse: <circle cx="12" cy="12" r="8.5" />,
  arrow: <path d="M5 19L19 5M9 5h10v10" />,
  line: <path d="M5 19L19 5" />,
  pen: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
  text: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
  highlight: <path d="M9 11l-5 5v4h8l3-3M20 11l-4.5 4.5a2 2 0 01-2.8 0l-4.2-4.2a2 2 0 010-2.8L13 4" />,
  blur: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
    </>
  ),
  step: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.5 9l2-1.2V16" />
    </>
  ),
  crop: <path d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2" />,
  undo: <path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  upload: <path d="M12 17V5M7 10l5-5 5 5M5 21h14" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </>
  ),
  rotateCw: <path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" />,
  rotateCcw: <path d="M3 12a9 9 0 103-6.7L3 8M3 3v5h5" />,
  flipH: <path d="M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5" />,
  flipV: <path d="M3 12h18M7 8l5-5 5 5M7 16l5 5 5-5" />,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  check: <path d="M5 12l5 5L20 7" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </>
  ),
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  eraser: <path d="M7 21h13M5 15l9-9 5 5-9 9H8z" />,
}

export default function Icon({ name, size = 18, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
