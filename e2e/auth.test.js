const { device, element, by, waitFor } = require('detox');

describe('VS Sport - Tests Auth', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: { notifications: 'YES', location: 'always', camera: 'YES' }
    });
  });

  it('App lance sans crash', async () => {
    await waitFor(element(by.text('VERSUS-SPORT'))).toBeVisible().withTimeout(10000);
  });

  it('Inscription fonctionne', async () => {
    await element(by.text("S'inscrire")).tap();
    await element(by.id('input-fullname')).typeText('Test User');
    await element(by.id('input-email')).typeText('test@test.com');
    await element(by.id('input-password')).typeText('Test123!');
    await element(by.text('Créer mon compte')).tap();
    await waitFor(element(by.text('Accueil'))).toBeVisible().withTimeout(5000);
  });
});
