/**
 * Join class names, dropping falsy values. Used to compose CSS-module classes
 * (which may be undefined) with optional/global classes.
 *
 *   cx(styles['flt-row'], styles[status])           // dynamic state class
 *   cx(styles.card, 'mono')                          // module + global utility
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
