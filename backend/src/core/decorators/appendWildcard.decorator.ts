import { Transform } from 'class-transformer';

export function AppendWildcard() {
  return Transform(({ value }) => {
    if (typeof value === 'string' && value.length > 0) {
      return `${value}*`;
    }
    return value;
  });
}
