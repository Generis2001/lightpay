import { SettingsScreen, InfoCard } from "@/components/ui/SettingsScreen";

export default function Help() {
  return (
    <SettingsScreen title="Help Centre">
      <InfoCard title="Sending money">
        Select a bank, enter the 10-digit account number, and wait for the
        verified account name. Review the amount and fee before entering your
        PIN.
      </InfoCard>
      <InfoCard title="Receiving money">
        Use Receive on the Home screen to see your account details. Copy or
        share them when your receiving account is available.
      </InfoCard>
      <InfoCard title="Pending payments">
        Open transaction history to check the current status and reference. A
        payment marked processing has not yet been confirmed by the provider.
      </InfoCard>
      <InfoCard title="Wallet availability">
        Naira payments are the current release focus. USD, Bitcoin, Ethereum,
        Solana and BNB are planned and cannot yet receive deposits or make
        transfers.
      </InfoCard>
    </SettingsScreen>
  );
}
