import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TurnEntry } from '../types'

const turns = atom({ plugin: 'turn-index', key: 'turns' } as const, [] as TurnEntry[])
const isOpen = atom({ plugin: 'turn-index', key: 'isOpen' } as const, false)

const oneLine = (text: string, width: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > width ? `${flat.slice(0, Math.max(width - 1, 1))}…` : flat
}

// The person's words in a user row: text blocks less the engine's <system-reminder> framing.
const promptText = (content: unknown): string => {
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : []
  return blocks
    .filter((block): block is { type: 'text'; text: string } => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim())
    .filter(text => text !== '' && !text.startsWith('<'))
    .join(' ')
}

// Earlier prompts come from the session's transcript file, whose row uuids are the transcript rows' requestIds.
const loadHistory = async ($: EngineInterface) => {
  const [id, cwd] = await Promise.all([$.session.id(), $.session.cwd()])
  const slug = cwd.replace(/[^a-zA-Z0-9]/g, '-')

  // Streamed, since $.fs.read refuses a file over 4 MiB and long sessions pass that.
  const found: TurnEntry[] = []
  const take = (line: string) => {
    if (line.trim() === '') return
    try {
      const row = JSON.parse(line)
      if (row.type !== 'user' || row.isMeta || row.isSidechain || typeof row.uuid !== 'string') return
      const text = promptText(row.message?.content)
      if (text !== '') found.push({ id: row.uuid, text })
    } catch {
      // a partly written last line
    }
  }

  let pending = ''
  for await (const chunk of $.process.spawn({
    // The config dir is the shell's to resolve: CLAUDE_CONFIG_DIR, else ~/.claude.
    argv: ['sh', '-c', 'cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/$1/$2.jsonl"', 'sh', slug, id],
  })) {
    if (chunk.stream !== 'stdout') continue
    const lines = (pending + chunk.text).split('\n')
    pending = lines.pop() ?? ''
    lines.forEach(take)
  }
  take(pending)

  await update($, turns, list => {
    const seen = new Set(found.map(turn => turn.id))
    return [...found, ...list.filter(turn => !seen.has(turn.id))]
  })
}

const refresh = async ($: EngineInterface) => {
  try {
    await loadHistory($)
  } catch {
    // the list is a convenience; never hold up the turn
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // A plugin above may pass session.append by, so re-read the transcript as each turn starts and ends.
  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) await refresh($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)
    const list = await read($, turns)
    const open = await read($, isOpen)
    const width = Math.max(e.props.bodyColumns - 8, 10)

    return (
      <Box flexDirection="column">
        <Button
          key="toggle"
          plain
          dimColor
          label={`${open ? '▾' : '▸'} Turns (${list.length})`}
          onPress={() => update($, isOpen, value => !value)}
        />
        {open
          ? list.map((turn, index) => (
              <Button
                key={`turn:${turn.id}`}
                plain
                label={oneLine(`${index + 1}. ${turn.text}`, width)}
                onPress={async () => {
                  const result = await $.ui.scroll({ to: { requestId: turn.id }, block: 'start' })
                  // Desktop refuses plugin scrolls; the terminal can't reach a turn it no longer draws.
                  if ('deny' in result) $.ui.toast(`跳不過去：這個介面不支援捲動，或這則較早的訊息已不在畫面上（${result.deny}）`)
                }}
              />
            ))
          : null}
      </Box>
    )
  })
}
