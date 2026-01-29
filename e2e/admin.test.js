const { device, element, by, waitFor } = require('detox');

describe('VS Sport - Tests Admin', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('Admin panel ne crash pas', async () => {
    await element(by.text('Profil')).tap();
    await element(by.id('version-number')).multiTap(5);
    await waitFor(element(by.text('Code Administrateur'))).toBeVisible().withTimeout(2000);
  });
});
