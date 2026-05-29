import { getSetups, getSetupStats } from '@/lib/queries/playbook'
import { PlaybookClient } from '@/components/playbook/PlaybookClient'

export default async function PlaybookPage() {
  const setups = await getSetups()
  const stats = await Promise.all(setups.map(s => getSetupStats(s.id)))
  const setupsWithStats = setups.map((s, i) => ({ ...s, stats: stats[i] }))
  return <PlaybookClient setups={setupsWithStats} />
}
