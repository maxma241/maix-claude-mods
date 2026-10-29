export type TurnEntry = { id: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'turn-index': { turns: TurnEntry[]; isOpen: boolean }
  }
}
