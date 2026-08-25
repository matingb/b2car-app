export function getArregloDeleteConfirmationMessage(cobrosCount: number): string {
  const baseMessage = "Estas seguro de que deseas eliminar este arreglo?";

  if (!Number.isFinite(cobrosCount) || cobrosCount <= 0) {
    return baseMessage;
  }

  if (cobrosCount === 1) {
    return `${baseMessage} Tambien se eliminara 1 cobro asociado y se revertira su operacion de ingreso en la cuenta financiera involucrada.`;
  }

  return `${baseMessage} Tambien se eliminaran ${cobrosCount} cobros asociados y se revertiran sus operaciones de ingreso en las cuentas financieras involucradas.`;
}
