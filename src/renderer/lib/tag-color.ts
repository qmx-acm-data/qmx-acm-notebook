/** Stable tag colors shared by problem lists, the picker, and daily hints. */
export function tagColorClass(value: string): string {
  let hash = 0;
  for (const character of value) hash = (hash + character.codePointAt(0)!) % 5;
  return `tag-color-${hash}`;
}
