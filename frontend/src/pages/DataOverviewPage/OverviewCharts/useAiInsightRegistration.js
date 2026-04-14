import { useEffect } from 'react';
import { useDataOverview } from '../../../contexts/DataOverviewContext';

export default function useAiInsightRegistration(cardKey, provider) {
  const { registerAiInsightProvider, unregisterAiInsightProvider } = useDataOverview();

  useEffect(() => {
    if (!cardKey || typeof provider !== 'function') return undefined;
    registerAiInsightProvider(cardKey, provider);
    return () => unregisterAiInsightProvider(cardKey, provider);
  }, [cardKey, provider, registerAiInsightProvider, unregisterAiInsightProvider]);
}

