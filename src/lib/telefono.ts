export function formatTelephoneNumber(codigo_pais: string | undefined, number: string): string {
  if(!number) return '';
  if (!codigo_pais) {
    return number;
  }
  return `+${codigo_pais} ${number}`;
}