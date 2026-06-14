import { getAnalysisOptions } from '@/lib/queries/analysisOptions'
import { getTradesForAnalysis } from '@/lib/queries/analytics'
import { assembleAnalysis } from '@/lib/analytics/compute'
import { AnalysisClient } from '@/components/analysis/AnalysisClient'

export default async function AnalysisPage() {
  const options = await getAnalysisOptions()
  // Default to a single currency scope so the initial view never blends currencies.
  const currency = options.currencies[0]

  const trades = await getTradesForAnalysis({ currency })

  const initial = {
    ...assembleAnalysis(trades, 'setup'),
    currency,
  }

  return <AnalysisClient initial={initial} options={options} />
}
