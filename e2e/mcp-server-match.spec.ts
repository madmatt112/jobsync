import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { test, expect, uniqueName } from "./fixtures";

// A posting of at least 150 words so classifyDescriptionCompleteness returns
// "full" (DESCRIPTION_FULL_MIN_WORDS = 150) — same text as
// e2e/mcp-write-tools.spec.ts:16-32, reused so the skip reply is proven
// against a posting that would otherwise clear the match directive.
const FULL_POSTING =
  "We are seeking a dedicated and experienced full stack software engineer " +
  "to join our growing product engineering team and help us build the next " +
  "generation of our customer facing platform. In this role you will design, " +
  "develop, test, and ship features end to end across the entire stack, " +
  "working closely with product managers, designers, and fellow engineers to " +
  "turn ideas into reliable, well tested software. You will own services " +
  "written in TypeScript and Node, build responsive interfaces with React, " +
  "model data in relational databases, and improve the performance, " +
  "observability, and security of everything you touch. We expect strong " +
  "communication skills, a pragmatic approach to trade offs, and a genuine " +
  "care for the people who use what we build. You should be comfortable " +
  "mentoring junior engineers, reviewing pull requests thoughtfully, and " +
  "contributing to technical planning. Experience with cloud infrastructure, " +
  "continuous integration, and automated testing is highly valued. We offer " +
  "competitive compensation, flexible remote work, and real opportunities to " +
  "grow your career with us over time.";

// Under DESCRIPTION_PARTIAL_MIN_WORDS (40), so classifyDescriptionCompleteness
// returns "title-only" and buildMatchOffer replies with its thin-description
// note instead of a directive or a queued match.
const THIN_DESCRIPTION =
  "Backend engineer role at a growing startup working on internal APIs.";

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

function toolText(result: ToolResult): string {
  return (result.content as Array<{ type: string; text?: string }>)
    .map((c) => c.text ?? "")
    .join("\n");
}

function extractJobId(text: string): string {
  const jobId = text.match(/\(id: ([^)]+)\)/)?.[1];
  expect(jobId).toBeTruthy();
  return jobId!;
}

// Drives the real MCP protocol with the "Score MCP jobs on the server"
// switch on, proving the switch persists across a reload (Req 3.2) and that
// skipMatch and a thin description both reply without ever reaching the
// queued path, so no real provider is called (Req 4.6, 8.3; design D10).
test.describe("MCP server-side match", () => {
  // The restriction barring this suite from the live instance means it runs
  // against a throwaway db that carries no seeded admin account, unlike the
  // persistent e2e instance other suites assume. Seed it here (same flow as
  // the untracked e2e-local.setup.ts) so the fixtures' `page` login succeeds
  // without relying on that gitignored, non-wired-in global setup.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/signup");
    await page.getByPlaceholder("Your Name").fill("Admin");
    await page.getByPlaceholder("id@example.com").fill("admin@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.locator("button[type=submit]").click();
    await Promise.race([
      page.waitForURL(/dashboard/, { timeout: 60_000 }),
      page.getByText("already exists").waitFor({ timeout: 60_000 }),
    ]);
    await page.close();
  });

  test("switch persists, skip and thin-description note reply", async ({
    page,
    baseURL,
    cleanup,
  }) => {
    test.slow();
    const tokenName = uniqueName("e2e server match token");

    // Issue a token through the Settings UI, as mcp-write-tools does.
    await page.goto("/dashboard/settings");
    await page.getByText("MCP Access").click();
    await page.getByRole("button", { name: "Generate" }).click();
    await page.getByPlaceholder("e.g. Claude Desktop").fill(tokenName);
    await page.getByRole("button", { name: "Generate" }).click();
    cleanup.mcpToken(tokenName);

    const revealDialog = page.getByRole("dialog", { name: "Token Created" });
    await expect(revealDialog).toBeVisible();
    const token = await revealDialog.getByRole("textbox").inputValue();
    expect(token).toMatch(/^jsync_/);
    await page.getByRole("button", { name: "I saved my token" }).click();

    // Settings defaults to the AI Provider section, which renders the switch.
    await page.goto("/dashboard/settings");
    const serverMatchSwitch = page.getByRole("switch", {
      name: "Score MCP jobs on the server",
    });
    await expect(serverMatchSwitch).toHaveAttribute("aria-checked", "false");
    await serverMatchSwitch.click();
    await expect(serverMatchSwitch).toHaveAttribute("aria-checked", "true");
    // Wait for the save to land before reloading, not just the optimistic UI.
    await expect(page.getByText("Server-side matching on.")).toBeVisible();

    // Reload: the switch reads its stored value again, proving it persists.
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Score MCP jobs on the server" }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 20000 });

    try {
      const transport = new StreamableHTTPClientTransport(
        new URL("/api/mcp", baseURL),
        { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const client = new Client({ name: "e2e-test-client", version: "1.0.0" });
      await client.connect(transport);

      // skipMatch on a full posting: skip wins over queueing even with the
      // switch on, so no real provider is ever reached (design D10).
      const skipTitle = uniqueName("e2e skip job");
      const skipCompany = uniqueName("e2e skip company");
      const skipResult = await client.callTool({
        name: "add_job",
        arguments: {
          company: skipCompany,
          jobTitle: skipTitle,
          jobDescription: FULL_POSTING,
          skipMatch: true,
        },
      });
      const skipText = toolText(skipResult);
      expect(skipText).toContain("Match skipped on request");
      expect(skipText).not.toContain("SYSTEM PROMPT:");
      cleanup.title(skipTitle);
      cleanup.company(skipCompany);
      cleanup.job(extractJobId(skipText));

      // A title-only description under 40 words replies with the thin note,
      // never the queued text, regardless of the switch.
      const thinTitle = uniqueName("e2e thin job");
      const thinCompany = uniqueName("e2e thin company");
      const thinResult = await client.callTool({
        name: "add_job",
        arguments: {
          company: thinCompany,
          jobTitle: thinTitle,
          jobDescription: THIN_DESCRIPTION,
        },
      });
      const thinText = toolText(thinResult);
      expect(thinText).toContain("too thin to score");
      expect(thinText).not.toContain("Server-side match queued");
      cleanup.title(thinTitle);
      cleanup.company(thinCompany);
      cleanup.job(extractJobId(thinText));

      await client.close();
    } finally {
      // Turn the switch back off so other MCP suites keep their directive
      // replies and never queue a match against a real provider (design D6).
      await page.goto("/dashboard/settings");
      const switchOff = page.getByRole("switch", {
        name: "Score MCP jobs on the server",
      });
      if ((await switchOff.getAttribute("aria-checked")) === "true") {
        await switchOff.click();
        await expect(switchOff).toHaveAttribute("aria-checked", "false");
      }
    }
  });
});
