export function createWalletPrivacyGuard() {
  let active = false;
  let revision = 0;
  return {
    activate() {
      active = true;
    },
    lock() {
      active = false;
      revision++;
    },
    begin() {
      const started = revision;
      return () => active && revision === started;
    },
  };
}
