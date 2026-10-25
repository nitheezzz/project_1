import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.account.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const logoutMutation = trpc.account.logout.useMutation({
    onSuccess: () => utils.account.me.setData(undefined, null),
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        !(error instanceof TRPCClientError) ||
        error.data?.code !== "UNAUTHORIZED"
      )
        throw error;
    } finally {
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {
        // Session storage can be unavailable in a restrictive browser.
      }
      utils.account.me.setData(undefined, null);
      await utils.account.me.invalidate();
    }
  }, [logoutMutation, utils]);

  return useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      refresh: () => meQuery.refetch(),
      logout,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      meQuery.error,
      logoutMutation.error,
      logoutMutation.isPending,
      logout,
      meQuery.refetch,
    ]
  );
}
