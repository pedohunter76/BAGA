import { createContext, useContext } from "react";
import type { readState } from "./db";
import type { CigaretteLog, View } from "./domain";
export type State = Awaited<ReturnType<typeof readState>>;
export interface AppContextValue extends State {
  navigate: (view: View) => void;
  openLog: (log?: CigaretteLog, date?: string) => void;
  quickLog: () => void;
  openOnboarding: () => void;
  perform: (
    action: () => Promise<unknown>,
    message?: string,
    undo?: () => Promise<unknown>,
  ) => Promise<boolean>;
  toast: (message: string) => void;
  now: Date;
  install: () => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  return useContext(AppContext)!;
}
