import { LandingA } from './a-editorial/Landing.js';
import { SetupA } from './a-editorial/Setup.js';
import { WorkspaceA } from './a-editorial/Workspace.js';
import { DoneA } from './a-editorial/Done.js';
import { SettingsA } from './a-editorial/Settings.js';

import { LandingB } from './b-console/Landing.js';
import { SetupB } from './b-console/Setup.js';
import { WorkspaceB } from './b-console/Workspace.js';
import { DoneB } from './b-console/Done.js';
import { SettingsB } from './b-console/Settings.js';

import { LandingC } from './c-mission/Landing.js';
import { SetupC } from './c-mission/Setup.js';
import { WorkspaceC } from './c-mission/Workspace.js';
import { DoneC } from './c-mission/Done.js';
import { SettingsC } from './c-mission/Settings.js';

export type VariantTrack = 'a' | 'b' | 'c';
export type VariantPage = 'landing' | 'setup' | 'workspace' | 'done' | 'settings';

export const variants: Record<VariantTrack, Record<VariantPage, React.ComponentType>> = {
  a: { landing: LandingA, setup: SetupA, workspace: WorkspaceA, done: DoneA, settings: SettingsA },
  b: { landing: LandingB, setup: SetupB, workspace: WorkspaceB, done: DoneB, settings: SettingsB },
  c: { landing: LandingC, setup: SetupC, workspace: WorkspaceC, done: DoneC, settings: SettingsC },
};
