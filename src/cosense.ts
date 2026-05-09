export class CosenseWriter {
  private get api() {
    return window.cosense?.Page;
  }

  isAvailable(): boolean {
    return Boolean(this.api);
  }

  requireApi() {
    const api = this.api;
    if (!api) {
      throw new Error("Cosense Page Edit API is not available.");
    }
    return api;
  }

  async appendLine(text: string): Promise<void> {
    const index = this.getCurrentLines().length;
    this.requireApi().insertLine(text, index);
    await this.requireApi().waitForSave();
  }

  async insertLine(index: number, text: string): Promise<void> {
    this.requireApi().insertLine(text, index);
    await this.requireApi().waitForSave();
  }

  async updateLine(index: number, text: string): Promise<void> {
    this.requireApi().updateLine(text, index);
    await this.requireApi().waitForSave();
  }

  async clearLine(index: number): Promise<void> {
    this.requireApi().updateLine("", index);
    await this.requireApi().waitForSave();
  }

  getCurrentLines(): ScrapboxLine[] {
    return window.scrapbox?.Page?.lines ?? [];
  }
}
