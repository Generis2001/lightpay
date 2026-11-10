import { SettingsScreen, InfoCard } from "@/components/ui/SettingsScreen";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";

export default function AccountLimits() {
  const { data, isError, isLoading, refetch } = useQuery({ queryKey: ['account-limits'], queryFn: async () => (await api.get('/wallets/limits')).data.data });
  return <SettingsScreen title="Verification & Limits">
    {isLoading ? <InfoCard title="Account limits">Loading your limits…</InfoCard> : isError ? <><InfoCard title="Limits unavailable">Please try again to view your current payment limits.</InfoCard><Button title="Try again" onPress={() => refetch()} /></> : <>
      <InfoCard title={`Your account: Tier ${data.tier}`}>{data.tier === 0 ? 'Your identity has not been verified.' : 'Your identity verification tier is confirmed.'}</InfoCard>
      <InfoCard title="Daily payment limit">{`₦${Number(data.dailyLimit).toLocaleString('en-NG')} per day. ₦${Number(data.remainingToday).toLocaleString('en-NG')} remains today. Amounts include fees; the day resets at midnight in Nigeria.`}</InfoCard>
      <InfoCard title="Per payment">{`Up to ₦${Number(data.perTransactionLimit).toLocaleString('en-NG')}, including fees. Available balance also applies.`}</InfoCard>
    </>}
    <Button title="Verify identity" onPress={() => router.push("/(modals)/verify-identity")} />
    <InfoCard title="Identity verification">Verify your BVN for Tier 1. Complete NIN verification and a live selfie for Tier 2 when verification is activated.</InfoCard>
  </SettingsScreen>;
}
