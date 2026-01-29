const { device, element, by, waitFor } = require('detox');

describe('VS Sport - Tests Profil', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('useFocusEffect - Pas de boucle infinie (10 aller-retours)', async () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await element(by.text('Profil')).tap();
      await waitFor(element(by.text('Mon Profil'))).toBeVisible().withTimeout(2000);
      await new Promise(r => setTimeout(r, 100));
      
      await element(by.text('Accueil')).tap();
      await waitFor(element(by.text('Tableau de bord'))).toBeVisible().withTimeout(2000);
      await new Promise(r => setTimeout(r, 100));
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ 10 aller-retours en ${duration}ms`);
  });

  it('Modifier profil ne crash pas', async () => {
    await element(by.text('Profil')).tap();
    await element(by.id('btn-edit-profile')).tap();
    await waitFor(element(by.text('Modifier le profil'))).toBeVisible().withTimeout(3000);
  });
});
