import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { setArl } from "@/api/user";
import { userProfileAtom, showArlInputAtom } from "@/atoms/app";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ArlInput() {
  const [value, setValue] = useState("");
  const setUserProfile = useSetAtom(userProfileAtom);
  const setShowArlInput = useSetAtom(showArlInputAtom);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (arl: string) => setArl(arl),
    onSuccess: (data) => {
      setUserProfile(data.user);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success(`Logged in as ${data.user.name}`);
      setShowArlInput(false);
      setValue("");
    },
    onError: (error) => {
      toast.error(`Failed to set ARL: ${error.message}`);
    },
  });

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-muted/30">
      <Input
        type="password"
        placeholder="Paste Deezer ARL cookie (192 hex chars)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 font-mono text-xs"
      />
      <Button
        size="sm"
        disabled={!value.trim() || mutation.isPending}
        onClick={() => mutation.mutate(value)}
      >
        {mutation.isPending ? "Saving..." : "Save"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setShowArlInput(false);
          setValue("");
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
