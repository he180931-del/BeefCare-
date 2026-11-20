/** Ghép class Tailwind, bỏ qua giá trị rỗng. */
export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')
