import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { fetchUserProfile, setArl } from "@/api/user";
import { userProfileAtom } from "@/atoms/app";
import { toast } from "sonner";

export function useUser() {
  const setUserProfile = useSetAtom(userProfileAtom);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["user", "me"],
    queryFn: fetchUserProfile,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (profileQuery.data) {
      setUserProfile(profileQuery.data);
    } else if (profileQuery.isError) {
      setUserProfile(null);
    }
  }, [profileQuery.data, profileQuery.isError, setUserProfile]);

  const arlMutation = useMutation({
    mutationFn: (arl: string) => setArl(arl),
    onSuccess: (data) => {
      setUserProfile(data.user);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success(`Logged in as ${data.user.name}`);
    },
    onError: (error) => {
      toast.error(`Failed to set ARL: ${error.message}`);
    },
  });

  return {
    user: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    setArl: arlMutation.mutate,
    isSettingArl: arlMutation.isPending,
  };
}
