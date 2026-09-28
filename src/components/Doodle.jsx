// A small flower like the ones in the logo, for decorating a few headers.
// Purely decorative: hidden from screen readers. Put it inside an element
// with className="doodle-wrap" (it sits in that element's top-right corner).
export default function Doodle({ green = false }) {
  return (
    <svg className={green ? 'doodle green' : 'doodle'} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 9.8C10 6 6.5 7 7.6 10.3 8.4 12 10.4 12 12 12M14.2 12C18 10 17 6.5 13.7 7.6 12 8.4 12 10.4 12 12M12 14.2C14 18 17.5 17 16.4 13.7 15.6 12 13.6 12 12 12M9.8 12C6 14 7 17.5 10.3 16.4 12 15.6 12 13.6 12 12" />
    </svg>
  )
}

// Where the files in public/ live. On GitHub Pages the app is under
// /<repo-name>/, so "/house.png" would point to the wrong place.
export const asset = (name) => import.meta.env.BASE_URL + name
