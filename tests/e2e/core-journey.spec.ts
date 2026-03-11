import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Log in" }).click();

  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForTimeout(800);
    if (page.url().includes("/login")) {
      await page.getByRole("button", { name: "Log in" }).click();
    }
  }
});

test("core journey covers diagnostic to learn with setup and explain", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const diagnosticRequired = page.getByText("Diagnostic required");
  if (await diagnosticRequired.isVisible()) {
    await page.getByRole("link", { name: /Start diagnostic/i }).first().click();

    if (page.url().endsWith("/diagnostic")) {
      await page.getByRole("button", { name: /Start diagnostic/i }).click();
    }

    let sawSetup = false;
    let sawExplain = false;

    for (let i = 0; i < 20; i += 1) {
      if ((await page.getByRole("heading", { name: /Diagnostic complete/i }).count()) > 0) {
        break;
      }

      const typeRow = page.locator("text=Type:").first();
      await expect(typeRow).toBeVisible();
      const typeText = (await typeRow.textContent()) ?? "";

      if (typeText.includes("MCQ")) {
        await page.locator("input[name='selectedChoiceIndex']").first().check();
        await page.getByRole("button", { name: /Submit answer/i }).click();
      } else if (typeText.includes("NUMERIC")) {
        await page.locator("input[name='numericInput']").fill("0");
        await page.getByRole("button", { name: /Submit answer/i }).click();
      } else if (typeText.includes("SETUP")) {
        sawSetup = true;
        await page.locator("textarea[name='setupInput']").fill("Given known values, identify unknowns, and choose kinematics equation.");
        await page.getByRole("button", { name: /Submit setup/i }).click();
      } else if (typeText.includes("EXPLAIN")) {
        sawExplain = true;
        await page.locator("textarea[name='explainInput']").fill("Constant acceleration changes velocity by equal amounts each second.");
        await page.getByRole("button", { name: /Submit explanation/i }).click();
      } else {
        throw new Error(`Unexpected type row: ${typeText}`);
      }
    }

    expect(sawSetup).toBe(true);
    expect(sawExplain).toBe(true);

    if ((await page.getByRole("link", { name: /Continue to dashboard/i }).count()) > 0) {
      await page.getByRole("link", { name: /Continue to dashboard/i }).click();
    }
  }

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: /Continue: Topic|Start or continue/i }).first().click();
  await expect(page.getByRole("heading", { name: "Learn" })).toBeVisible();
});

test("shows empty_response and evaluation_failed messaging", async ({ page }) => {
  test.skip(!!process.env.OPENAI_API_KEY, "evaluation_failed path depends on OpenAI being unavailable");

  await page.goto("/diagnostic");
  if (page.url().endsWith("/diagnostic")) {
    await page.getByRole("button", { name: /Start diagnostic/i }).click();
  }

  for (let i = 0; i < 20; i += 1) {
    if ((await page.getByRole("heading", { name: /Diagnostic complete/i }).count()) > 0) {
      break;
    }

    const typeRow = page.locator("text=Type:").first();
    await expect(typeRow).toBeVisible();
    const typeText = (await typeRow.textContent()) ?? "";

    if (typeText.includes("SETUP")) {
      await page.locator("textarea[name='setupInput']").fill(" ");
      await page.getByRole("button", { name: /Submit setup/i }).click();
      await expect(page.getByText(/Please enter an answer before submitting/i)).toBeVisible();

      await page.locator("textarea[name='setupInput']").fill("Given values, unknowns, and equation.");
      await page.getByRole("button", { name: /Submit setup/i }).click();
      continue;
    }

    if (typeText.includes("EXPLAIN")) {
      await page.locator("textarea[name='explainInput']").fill("Acceleration causes steady change in velocity.");
      await page.getByRole("button", { name: /Submit explanation/i }).click();
      await expect(page.getByText(/feedback evaluation was unavailable/i)).toBeVisible();
      break;
    }

    if (typeText.includes("MCQ")) {
      await page.locator("input[name='selectedChoiceIndex']").first().check();
      await page.getByRole("button", { name: /Submit answer/i }).click();
    } else if (typeText.includes("NUMERIC")) {
      await page.locator("input[name='numericInput']").fill("0");
      await page.getByRole("button", { name: /Submit answer/i }).click();
    }
  }
});

