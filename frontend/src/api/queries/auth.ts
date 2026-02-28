import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { post, get, setCsrfToken } from '../client';
import type { LoginResponse, SessionResponse } from '../types';
import type { LoginFormData } from '@/lib/validation';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await get<SessionResponse>('/auth/session');
      setCsrfToken(data.csrfToken);
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginFormData) =>
      post<LoginResponse>('/auth/login', data),
    onSuccess: (data) => {
      setCsrfToken(data.csrfToken);
      queryClient.setQueryData(['session'], data);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => post<{ ok: boolean }>('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['session'], null);
      queryClient.clear();
    },
  });
}
