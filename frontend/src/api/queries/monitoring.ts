import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../client';
import type { MetricsResponse, ProfilerResponse } from '../types';

export function useMetrics(enabled = true) {
  return useQuery({
    queryKey: ['monitoring', 'metrics'],
    queryFn: () => get<MetricsResponse>('/monitoring/metrics'),
    refetchInterval: 5000,
    enabled,
  });
}

export function useOperations(enabled = true) {
  return useQuery({
    queryKey: ['monitoring', 'operations'],
    queryFn: () => get<{ operations: MetricsResponse['currentOps'] }>('/monitoring/operations'),
    refetchInterval: 5000,
    enabled,
  });
}

export function useProfiler(dbName: string, enabled = true) {
  return useQuery({
    queryKey: ['monitoring', 'profiler', dbName],
    queryFn: () => get<ProfilerResponse>(`/monitoring/profiler?db=${encodeURIComponent(dbName)}`),
    enabled: enabled && !!dbName,
    refetchInterval: 10_000,
  });
}

export function useSetProfilerLevel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { db: string; level: number; slowms: number }) =>
      post<{ ok: boolean; level: number; slowms: number }>('/monitoring/profiler/level', data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['monitoring', 'profiler', variables.db],
      });
    },
  });
}

export function useKillOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opId: string) =>
      post<{ ok: boolean }>(`/monitoring/operations/${encodeURIComponent(opId)}/kill`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['monitoring', 'operations'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['monitoring', 'metrics'],
      });
    },
  });
}
