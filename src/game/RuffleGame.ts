import { type Browser, chromium, type Page } from "playwright";
import { startGameServer } from "./server";
import type { GameState, Move, SwapResult } from "./types";

export interface GameOptions {
  seed: number;
  /** Game clock budget. The clock only runs while the board is animating. Default 240 (the original). */
  timeLimitSeconds?: number;
  headless?: boolean;
}

/**
 * Drives one game of the patched King Candy Crush SWF inside Ruffle via Playwright.
 * The game runs on a manual clock, so between calls nothing moves.
 */
export class RuffleGame {
  private constructor(
    private browser: Browser,
    private page: Page,
    private server: ReturnType<typeof startGameServer>,
    readonly options: GameOptions,
  ) {}

  static async launch(options: GameOptions): Promise<RuffleGame> {
    const server = startGameServer();
    const browser = await chromium.launch({ headless: options.headless ?? true });
    const page = await browser.newPage({ viewport: { width: 755, height: 600 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error("[page]", e.message));
    const cfg = encodeURIComponent(
      JSON.stringify({ seed: options.seed, timeLimitSeconds: options.timeLimitSeconds ?? 240 }),
    );
    await page.goto(`${server.url}/#${cfg}`);
    // Wait for the bridge to register its callbacks on the player element.
    await page.waitForFunction(() => typeof (window as any).player?.cb_ping === "function", null, { timeout: 30_000 });
    const game = new RuffleGame(browser, page, server, options);
    await game.settle();
    return game;
  }

  private call<T>(name: string, ...args: unknown[]): Promise<T> {
    return this.page.evaluate(([n, a]) => (window as any).player[n](...(a as unknown[])), [
      name,
      args,
    ] as const) as Promise<T>;
  }

  async ping(): Promise<string> {
    return this.call<string>("cb_ping");
  }

  async state(): Promise<GameState> {
    return JSON.parse(await this.call<string>("cb_getState"));
  }

  /** Run ticks until the game is waiting for a move (through the intro, cascades, level changes). */
  async settle(maxTicks = 3000): Promise<{ ticks: number; state: GameState }> {
    return JSON.parse(await this.call<string>("cb_settle", maxTicks));
  }

  async advance(ticks: number): Promise<number> {
    return this.call<number>("cb_advance", ticks);
  }

  async legalMoves(): Promise<Move[]> {
    return JSON.parse(await this.call<string>("cb_legalMoves"));
  }

  async isLegal(m: Move): Promise<boolean> {
    return this.call<boolean>("cb_isLegal", ...m);
  }

  async swap(m: Move): Promise<SwapResult> {
    return JSON.parse(await this.call<string>("cb_swap", ...m));
  }

  /** Let hints show (default off so screenshots never leak a move). */
  async setHints(on: boolean): Promise<void> {
    await this.call<void>("cb_setHints", on);
  }

  /** PNG of the 755x600 stage as a human would see it. */
  async screenshot(): Promise<Buffer> {
    // Ruffle renders on the next animation frame; give it one.
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return this.page.locator("ruffle-player").screenshot({ type: "png" });
  }

  async close(): Promise<void> {
    await this.browser.close();
    this.server.stop();
  }
}
