// Drawn, not typed: the text symbols ⌂ ▣ ▤ read as a house, a checkbox and
// a list, and the last two said nothing about School or Work. One line
// weight, in the colour of the text around it.
const PATHS = {
  home: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M6 9.5v10h12v-10" />
      <path d="M10 19.5v-5.5h4v5.5" />
    </>
  ),
  school: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.8v4.4c0 1.3 2.5 2.8 5.5 2.8s5.5-1.5 5.5-2.8v-4.4" />
      <path d="M21.5 9.5v5" />
    </>
  ),
  work: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </>
  ),
};

export default function PlaceIcon({ id }) {
  const paths = PATHS[id];
  if (!paths) return null;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  );
}
