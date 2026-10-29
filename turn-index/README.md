# turn-index

在輸入框上方列出這個 session 裡你輸入過的每一則 prompt，每則一行；點一下就跳回那個 turn。

## 用法

1. 輸入框上方會出現 `▸ Turns (N)`，N 是目前的 prompt 數。
2. 點它展開清單，每則 prompt 一行，太長的用 `…` 截斷；再點一次收起。
3. 點清單裡的某一則，對話會捲到那則訊息，並讓它出現在畫面頂端。

## 安裝

在 terminal 版 Claude Code 的輸入框執行（第一次會問是否加入 marketplace，按 `y`，再選安裝範圍）：

```
/plugin install turn-index --marketplace maxma241/maix-claude-mods
```

或從 shell：

```
claude plugin install turn-index --marketplace maxma241/maix-claude-mods
```

## 運作方式

- 清單從這個 session 的 transcript 檔（`~/.claude/projects/<專案>/<session id>.jsonl`）讀取，所以 resume 回來的舊 session 也會列出之前的 prompt。
- 每個 turn 開始和結束時會重新讀一次，新的 prompt 會自動加進去。
- 系統附加的內容（`<system-reminder>` 等）和工具結果不會列入，只留你自己打的字。

## 限制

- **Desktop app（Claude Code 分頁）點了不會跳**：desktop 不開放 mod 捲動對話，點了會出現提示。清單本身仍可看。
- **Terminal 裡太早的 turn 可能跳不過去**：terminal 只保留最近畫出來的內容，已經不在畫面上的較早 turn 沒有東西可以捲過去，會出現提示。
- 只列主對話的 prompt，不含 subagent 的對話。
