# `.mcp.json` と `.claude/settings.json` の記述ルール

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

以下の内容を**必ず**記載する（既存の `settings.json` がある場合も、この項目を省略せずマージする）。

```json
{
  "enabledPlugins": {
    "expo@claude-plugins-official": true
  },
  "permissions": {
    "allow": [
      "Bash(curl https://api.cloudflare.com/client/v4/*)",
      "Bash(curl -sS https://api.cloudflare.com/client/v4/*)",
      "mcp__Cloudflare_Developer_Platform"
    ]
  },
  "env": {
    "CLOUDFLARE_ZONE_ID": "ca82f4b02981b675aa6c7c5221a010dc"
  }
}
```

- `permissions.allow`：Cloudflare API への `curl` と Cloudflare の MCP（`mcp__Cloudflare_Developer_Platform`）を、確認なしで実行できるようにする。
- `env.CLOUDFLARE_ZONE_ID`：Cloudflare のゾーン ID。DNS・Custom Domains・Email Routing・Access などゾーン単位の API で使う。