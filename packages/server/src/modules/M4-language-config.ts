import { LANGUAGE_REGISTRY, type Language } from '@zercade-dev/narn-shared';
import type { ProjectStore } from '../storage/types.js';
import { getProjectStore } from '../storage/registry.js';
import { InvalidLanguageError } from '../types/errors.js';

export class LanguageConfig {
  private readonly registry: Language[] = LANGUAGE_REGISTRY;
  // Resolve the project store lazily so a later setProjectStore() (e.g. per-test
  // injection) is honored even by this module-level singleton, which is
  // constructed at import time before any store is set.
  private readonly _ps?: ProjectStore;
  private get ps(): ProjectStore {
    return this._ps ?? getProjectStore();
  }

  constructor(ps?: ProjectStore) {
    this._ps = ps;
  }

  getRegistry(): Language[] {
    return this.registry;
  }

  getLanguage(code: string): Language | undefined {
    return this.registry.find((l) => l.code === code);
  }

  validateCode(code: string): void {
    if (!this.registry.some((l) => l.code === code)) {
      throw new InvalidLanguageError(code);
    }
  }

  async getActiveLanguages(projectId: string): Promise<Language[]> {
    const project = await this.ps.loadProject(projectId);
    return project.activeLanguages
      .map((code) => this.registry.find((l) => l.code === code))
      .filter((l): l is Language => l !== undefined);
  }

  async setActiveLanguages(projectId: string, codes: string[]): Promise<void> {
    for (const code of codes) {
      this.validateCode(code);
    }
    await this.ps.updateProject(projectId, { activeLanguages: codes });
  }

  async setSourceLanguage(projectId: string, code: string): Promise<void> {
    this.validateCode(code);
    await this.ps.updateProject(projectId, { sourceLanguage: code });
  }
}

export const languageConfig = new LanguageConfig();
