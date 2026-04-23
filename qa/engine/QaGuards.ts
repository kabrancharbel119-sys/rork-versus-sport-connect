export const isQaTestModeEnabled = (): boolean => {
  return process.env.EXPO_PUBLIC_QA_TEST_MODE === 'true';
};

export const assertQaTestMode = (): void => {
  if (!isQaTestModeEnabled()) {
    throw new Error('QA disabled: set EXPO_PUBLIC_QA_TEST_MODE=true to run simulations.');
  }
};
