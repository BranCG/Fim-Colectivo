const { test } = require('node:test');
const assert = require('node:assert/strict');
const { interpretarComando } = require('../src/lib/voiceCommands.ts');
test('comandos explícitos en español', () => {
  for (const word of ['Sí', 'sí acepto', 'Confirmo']) assert.equal(interpretarComando(word),'onSi');
  for (const word of ['A bordo', 'abordo', 'ya subió']) assert.equal(interpretarComando(word),'onAbordo');
  for (const word of ['No', 'No gracias', 'paso']) assert.equal(interpretarComando(word),'onNo');
});
test('la conversación y la voz del sistema no confirman acciones', () => {
  for (const word of ['sí, no', 'no a bordo', 'vamos', 'listo', 'si llega tarde', '¿Aceptas el viaje?', 'Ana paga con efectivo, ¿aceptas?', 'Di a bordo para confirmar']) {
    assert.equal(interpretarComando(word),null,word);
  }
});
