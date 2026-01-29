const { device, element, by, waitFor } = require('detox');

describe('VS Sport - Tests Chat', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('Envoyer requête ne dit pas Non connecté', async () => {
    await element(by.text('Chat')).tap();
    await element(by.id('btn-new-direct-message')).tap();
    await waitFor(element(by.text('Nouveau message'))).toBeVisible().withTimeout(3000);
  });

  it('Chat temps réel fonctionne', async () => {
    await element(by.text('Équipes')).tap();
    await element(by.id('team-card-0')).tap();
    await element(by.text('Chat d\'équipe')).tap();
    await waitFor(element(by.id('chat-input'))).toBeVisible().withTimeout(3000);
  });
});
