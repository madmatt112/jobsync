import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ServerMatchSettings from "@/components/settings/ServerMatchSettings";
import { toastSuccess, toastError } from "@/lib/toast";

const getUserSettings = vi.fn();
const updateServerSideMatch = vi.fn();

vi.mock("@/actions/userSettings.actions", () => ({
  getUserSettings: () => getUserSettings(),
  updateServerSideMatch: (enabled: boolean) => updateServerSideMatch(enabled),
}));

vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));

function mockStoredAi(ai: Record<string, unknown> = {}) {
  getUserSettings.mockResolvedValue({
    success: true,
    data: {
      userId: "u1",
      settings: {
        ai: { provider: "deepseek", model: "deepseek-flash", ...ai },
        display: {},
      },
    },
  });
}

describe("ServerMatchSettings", () => {
  beforeEach(() => {
    getUserSettings.mockReset();
    updateServerSideMatch.mockReset();
    (toastSuccess as any).mockClear();
    (toastError as any).mockClear();
  });

  // Contract: Req 3.1 — a user with no stored value for the setting reads the
  // switch as off.
  // Pre-condition: getUserSettings resolves with an ai settings object that
  // carries no serverSideMatch key.
  // Test: render(ServerMatchSettings).
  // Observable result: the rendered switch has aria-checked "false".
  // Source: requirements.md Req 3.1; design.md C3.
  it("reads off when there is no stored flag", async () => {
    mockStoredAi();

    render(<ServerMatchSettings />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });
  });

  // Contract: Req 3.2 — turning the setting on saves true and tells the
  // operator it is now on.
  // Pre-condition: the stored flag is off; updateServerSideMatch resolves
  // success.
  // Test: render(ServerMatchSettings), then click the switch.
  // Observable result: updateServerSideMatch is called with true, and
  // toastSuccess is called with "Server-side matching on.".
  // Source: requirements.md Req 3.2; author-brief-task-5.md task 5 prompt
  // (exact toast text).
  it("saves true and shows the on toast when toggled on", async () => {
    mockStoredAi();
    updateServerSideMatch.mockResolvedValue({ success: true });

    render(<ServerMatchSettings />);
    const switchEl = await screen.findByRole("switch");
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("aria-checked", "false"),
    );

    fireEvent.click(switchEl);

    await waitFor(() => {
      expect(updateServerSideMatch).toHaveBeenCalledWith(true);
      expect(toastSuccess).toHaveBeenCalledWith("Server-side matching on.");
    });
  });

  // Contract: a failed save reverts the switch to its previous value and
  // surfaces the returned message, so the operator is not shown a setting
  // that did not actually persist.
  // Pre-condition: the stored flag is off; updateServerSideMatch resolves
  // failure with a message.
  // Test: render(ServerMatchSettings), then click the switch.
  // Observable result: the switch reverts to aria-checked "false", and
  // toastError is called with the returned message.
  // Source: author-brief-task-5.md task 5 prompt (failure-revert criterion).
  it("reverts the switch and shows the returned message on a failed save", async () => {
    mockStoredAi();
    updateServerSideMatch.mockResolvedValue({
      success: false,
      message: "boom",
    });

    render(<ServerMatchSettings />);
    const switchEl = await screen.findByRole("switch");
    await waitFor(() =>
      expect(switchEl).toHaveAttribute("aria-checked", "false"),
    );

    fireEvent.click(switchEl);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("boom");
    });
    expect(screen.getByRole("switch")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
