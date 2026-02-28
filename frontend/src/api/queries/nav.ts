import { useQuery } from '@tanstack/react-query';
import { get } from '../client';
import type { NavResponse } from '../types';

export function useNav(enabled = true) {
  return useQuery({
    queryKey: ['nav'],
    queryFn: () => get<NavResponse>('/nav'),
    staleTime: 30_000,
    enabled,
  });
}
