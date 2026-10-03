export function interpretarComando(texto: string): 'onSi' | 'onNo' | 'onAbordo' | null {
  const normalizado = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(no|no gracias|paso|rechazo|rechazar|cancelar|negativo)$/.test(normalizado)) return 'onNo';
  if (/^(si|si acepto|si confirmo|acepto|confirmo|afirmativo)$/.test(normalizado)) return 'onSi';
  if (/^(a bordo|abordo|ya subio|subio)$/.test(normalizado)) return 'onAbordo';
  return null;
}
