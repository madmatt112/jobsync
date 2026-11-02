"use client";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  getUserSettings,
  updateServerSideMatch,
} from "@/actions/userSettings.actions";

function ServerMatchSettings() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsResult = await getUserSettings();
      if (settingsResult?.success && settingsResult.data?.settings?.ai) {
        setEnabled(Boolean(settingsResult.data.settings.ai.serverSideMatch));
      }
    };
    fetchSettings();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setEnabled(checked);
    const result = await updateServerSideMatch(checked);
    if (result?.success) {
      toastSuccess(
        checked ? "Server-side matching on." : "Server-side matching off.",
      );
    } else {
      setEnabled(!checked);
      toastError(result?.message);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-6">
      <Switch
        id="server-side-match"
        checked={enabled}
        onCheckedChange={handleToggle}
      />
      <div>
        <Label htmlFor="server-side-match">Score MCP jobs on the server</Label>
        <p className="text-sm text-muted-foreground">
          Jobs added or updated over MCP are scored in the background with
          the model above, using your provider key.
        </p>
      </div>
    </div>
  );
}

export default ServerMatchSettings;
