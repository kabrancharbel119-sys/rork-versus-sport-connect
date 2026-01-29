const { device, element, by, waitFor } = require('detox');

describe('VS Sport - Tests Équipes', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('Section Équipes qui recrutent visible', async () => {
    await element(by.text('Équipes')).tap();
    await waitFor(element(by.text('Mes Équipes'))).toBeVisible().withTimeout(3000);
    await element(by.id('teams-scroll')).scrollTo('bottom');
    await waitFor(element(by.text('Équipes qui recrutent'))).toBeVisible().withTimeout(2000);
  });

  it('Bouton Suivre fonctionne', async () => {
    await element(by.text('Équipes')).tap();
    await element(by.text('À découvrir')).tap();
    const followBtn = element(by.id('btn-follow-team-0'));
    await followBtn.tap();
    await waitFor(element(by.id('loading-follow-0'))).toBeVisible().withTimeout(1000);
  });
});
