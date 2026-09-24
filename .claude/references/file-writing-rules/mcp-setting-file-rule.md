# 機能要件の指示書の記述ルール

## アウトプット先
`/{output-directory}/.mcp.json`
`/{output-directory}/.claude/settings.json`


## 記入フォーマット
以下の情報を丸ごとコピー


`.mcp.json`
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    }
  }
}
```


`.claude/settings.json`
```json
{
  "enabledPlugins": {
    "expo@claude-plugins-official": true
  }
}
```