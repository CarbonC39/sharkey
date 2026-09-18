# Sharkey Soft Fork 功能记录

本仓库是 Sharkey 的 soft fork，目标是在保持 ActivityPub、API 和数据格式兼容的前提下，提供中文体验与实例自用功能。本文记录用户可见行为、关键边界和长期维护事项。

## 已实现

### 中文输入与 Emoji 搜索

- 发帖框提供稳定的中文行距和约六行最小高度；Emoji picker 支持简繁中文搜索词和按需加载的 CLDR 词库。
- 词库生成脚本、来源说明和许可证随索引保存。

### 远程自定义 Emoji Reaction

- 本站用户可对帖子已有的远程 emoji reaction +1，无需注册本站 emoji；API 不接受客户端 emoji URL。
- 必须匹配帖子已有的 `(name, host)` reaction 和缓存 emoji，并继续检查帖子可见性、reaction acceptance、敏感标记、角色权限、联邦 host 和 media-silenced host；不满足时回退为心形。
- 明确带 host 的 ActivityPub reaction 不从请求 tag 学习第三方 emoji；输出会校验 emoji URI authority。无 host 的标准联邦 emoji 仍按上游兼容路径学习，其 URL 视为不可信远程媒体。

### 搜索与实例简介

- 搜索页支持时间倒序和相关性排序，默认时间倒序，并保留各搜索后端的可见性过滤。
- 实例 description 支持 MFM 和换行；后台编辑提供补全与预览，原有 about HTML 清理不变。

### MFM 快捷输入 Picker

- 发帖框提供分类的 MFM 快捷输入，常用 Markdown 置顶；覆盖 cheatsheet 39 项并保留额外的斜体、删除线和 Ruby 项。
- 支持搜索、最近使用、选区包裹、链接/Ruby 后续填写，以及带白名单预设的参数菜单；块级语法和 parser/renderer 参数必须保持有效。

### Deck 个人背景

- Deck 增加“使用个人背景”选项，默认关闭；响应式使用当前账户背景，自定义壁纸与个人背景互斥，切换即时生效。
- 未登录、账户切换或无背景 URL 时安全降级；缺失旧偏好使用关闭状态，不改变旧用户行为。

### 隔离测试环境

使用锁定依赖和隔离 PostgreSQL/Redis 的测试 helper；详见 [`NIX_TESTING.md`](./NIX_TESTING.md)。

## 待讨论：公开网盘分类

尚未实现。需先确定公开范围、未登录访问、权限边界、个人资料入口及其与现有文件夹的关系；确定前不新增公开 API 或默认入口。

## 维护索引

- 输入与搜索：`packages/frontend/src/components/MkPostForm.vue`、`packages/frontend/src/components/MkTextarea.vue`、`packages/frontend/src/components/MkEmojiPicker.vue`、`packages/frontend/src/utility/search-unicode-emoji.ts`、`packages/backend/src/core/SearchService.ts`、`packages/frontend/src/pages/search.note.vue`。
- Remote reaction/联邦：`packages/backend/src/core/ReactionService.ts`、`packages/backend/src/core/activitypub/ApInboxService.ts`、`packages/backend/src/core/activitypub/ApRendererService.ts`、`packages/frontend/src/components/MkReactionsViewer.reaction.vue`。
- MFM/Deck：`packages/frontend/src/utility/mfm-function-picker.ts`、`packages/frontend/src/components/MkMfmPicker.vue`、`packages/frontend/test/mfm-function-picker.test.ts`、`packages/frontend/src/pages/settings/deck.vue`、`packages/frontend/src/ui/deck.vue`、`packages/frontend/src/preferences/def.ts`。

## 上游合并清单

- 运行受影响的 unit/E2E、eslint 和 `git diff --check`；reaction、ActivityPub 或数据库变化需使用隔离 PostgreSQL/Redis 验证。
- 合并时复核 MFM cheatsheet/locale/parser 参数、ReactionService 的角色/host/cache 边界、ActivityPub emoji URI 校验、Deck 响应式背景和偏好默认值。
- 远程 emoji URL 必须继续遵守实例的 HTTPS、私网地址和大小限制；不得把客户端 URL 重新引入 reaction API。
