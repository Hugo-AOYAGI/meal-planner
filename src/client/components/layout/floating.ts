/**
 * The line of the floating buttons, at the bottom of the page column (above the tab bar on phones): the Assistant on
 * the right, the Planning's "Aujourd'hui" on the left. Absolute in the column, outside the scrolling `<main>`, so they
 * stay put while the page scrolls under them. Hidden while the keyboard is up.
 */
export const FLOATING_ROW = "absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 keyboard:hidden";
