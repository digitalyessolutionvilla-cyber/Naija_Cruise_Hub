import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_COIN_TO_NAIRA_RATE, normalizeCoinToNairaRate } from '@/lib/wallet';

const sb = supabase as any;

export function useExchangeRate() {
    const [rate, setRate] = useState(DEFAULT_COIN_TO_NAIRA_RATE);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const { data, error } = await sb
            .from('coin_exchange_settings')
            .select('coin_to_naira_rate')
            .eq('id', true)
            .maybeSingle();

        if (!error && data) {
            setRate(normalizeCoinToNairaRate(data.coin_to_naira_rate));
        } else {
            setRate(DEFAULT_COIN_TO_NAIRA_RATE);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { rate, loading, refresh };
}
