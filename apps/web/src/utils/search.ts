export const normalizeSearchText = (value: string): string =>
  value
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (character) => ({
      ç: 'c',
      ğ: 'g',
      ı: 'i',
      ö: 'o',
      ş: 's',
      ü: 'u',
    })[character] || character);
