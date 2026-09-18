# Sharkey Soft Fork 功能记录

本仓库是 [Sharkey](https://activitypub.software/TransFem-org/Sharkey) 的 soft fork，目标是在保持上游兼容、便于持续合并更新的前提下，加入中文使用者体验和实例自用功能。

本文按代码状态记录功能。合并上游时，请同时检查各节的“主要实现位置”和维护注意事项；“当前工作区未提交”不代表已经可以发布。

## 已提交：`145cd18a1b`

提交信息：`feat: improve Chinese UX, reactions, and search`。以下功能已包含在该提交中。

### 中文输入与发帖框

- 发帖框使用固定 `line-height: 1.5`，避免中文 fallback 字体造成行距抖动。
- 发帖框最小高度调整为约 6 行（`9em`）。
- 主要文件：`packages/frontend/src/components/MkPostForm.vue`、`packages/frontend/src/components/MkTextarea.vue`。

### Unicode Emoji 中文搜索

- Emoji picker 内置简体中文 Unicode Emoji 搜索词；`zh-TW` 额外加载繁体中文搜索词。
- 中文索引使用动态导入，不进入首屏 bundle；搜索仍保留名称、本站额外词库及最多 100 项结果的原有策略。
- 词库由 Unicode CLDR 数据生成，生成脚本、来源说明和 Unicode License 与索引保存在仓库中。
- 主要文件：
  - `packages/frontend/src/components/MkEmojiPicker.vue`
  - `packages/frontend/src/utility/search-unicode-emoji.ts`
  - `packages/frontend/src/unicode-emoji-indexes/`
  - `packages/frontend/scripts/generate-unicode-emoji-index.mjs`

### 复用远程自定义 Emoji Reaction

- 本站用户可以对帖文上已经存在的远程自定义 emoji reaction 直接 +1，无需将该 emoji 注册为本站本地 emoji。
- 服务端只接受该帖文上已经存在、且已通过联邦学习并缓存的精确 `(name, host)` emoji。
- 不接受客户端提供 emoji URL；仍执行联邦 host、媒体静默和敏感 reaction 限制。
- ActivityPub 输出使用远程 emoji 的原始身份 URI，并防止伪造第三方 emoji URI。
- 主要实现：
  - `packages/backend/src/core/ReactionService.ts`
  - `packages/backend/src/core/activitypub/ApInboxService.ts`
  - `packages/backend/src/core/activitypub/ApRendererService.ts`
  - `packages/frontend/src/components/MkReactionsViewer.reaction.vue`

### 搜索排序

- 搜索页提供“时间（从新到旧）”和“相关性”两种排序方式。
- 默认使用时间倒序。
- SQL、PGroonga、PostgreSQL tsvector 和 Meilisearch 分别使用适合自身的相关性排序。
- Meilisearch 在数据库可见性、屏蔽、静音和停权过滤后计算公开分页偏移，并保持搜索引擎返回顺序。
- 主要实现：
  - `packages/frontend/src/pages/search.note.vue`
  - `packages/backend/src/core/SearchService.ts`
  - `packages/backend/src/server/api/endpoints/notes/search.ts`

### 实例简介 MFM

- 实例 description 支持 MFM 和换行。
- 管理后台 description 编辑框支持 MFM 自动补全和预览。
- 管理后台预览沿用通用 MFM 渲染器的普通样式，不使用黑灰色面板预览；普通预览不强制额外的 130px 最小高度。
- 原有 `about` HTML 内容和清理逻辑保持不变；仅 description fallback 改用 MFM。
- 主要实现：
  - `packages/frontend/src/components/MkVisitorDashboard.vue`
  - `packages/frontend/src/pages/about.overview.vue`
  - `packages/frontend/src/pages/admin/settings.vue`

## 当前工作区未提交

以下两项已实现于当前工作区，但尚未形成提交；发布前应先完成审查并补充验证。

### MFM 快捷输入 Picker

- 发帖框提供仿 Emoji picker 的 MFM 快捷输入界面，默认开启，仍可在偏好设置中关闭。
- “常用 Markdown”固定置顶，包含粗体、斜体、删除线、链接、引用、行内代码和代码块。
- 覆盖 Sharkey MFM cheatsheet 的全部 39 项，并额外提供斜体、删除线和 Ruby 注音，因此 picker 数据目前为 42 项。
- 按文本与嵌入、布局、外观、动画和高级功能分类；按钮显示本地化样式名称。
- 正常桌面宽度每行显示 3 个条目，窄屏自动收缩为 2/1 列；动画分类标题保留“动画”，条目名称不再重复此前缀。
- 支持本地化名称、id/tag/语法搜索和设备端最近使用记录（最多 16 项）。
- 纯样式包裹已有 textarea 选区后取消范围选中，把 caret 放到完整插入内容末尾；链接和 Ruby 仍分别选中 URL/注音以便继续填写。无选区时保留可编辑的 placeholder 或内部光标。插入位置使用 JavaScript 字符串索引，即 textarea 所需的 UTF-16 偏移。
- 带参数的样式显示参数角标；桌面可右键，触屏可长按打开白名单参数预设。触屏移动超过阈值或 pointer cancel 会取消长按，长按触发后的 contextmenu 会去重。
- 主要文件：
  - `packages/frontend/src/components/MkMfmPicker.vue`
  - `packages/frontend/src/components/MkMfmPickerDialog.vue`
  - `packages/frontend/src/utility/mfm-function-picker.ts`
  - `packages/frontend/src/components/MkPostForm.vue`
  - `packages/frontend/test/mfm-function-picker.test.ts`
  - `packages/frontend/src/store.ts`（最近使用）
  - `sharkey-locales/en-US.yml`、`sharkey-locales/zh-CN.yml`、`locales/index.d.ts`

维护注意事项：参数名和值必须与 `packages/frontend-shared/js/const.ts` 及当前 MFM renderer/parser 保持一致（尤其 `followmouse.rotateByVelocity`、`border.noclip`、时间参数和 Ruby）；修改 cheatsheet 时要同步 39 项覆盖测试、标签、搜索词和 locale。`[search]` 是行级语法，插入时必须保持独占行并正确处理边界空格；长按参数菜单关闭时必须清理去重状态。这两项均应作为回归测试约束。

本轮界面反馈：入口和分类名称应明确为 MFM 样式/快捷输入，避免使用“装饰键盘”等容易误解的称呼；样式按钮保持紧凑网格布局，补齐各项样式图标，并让选中/按下状态始终保留清晰的高亮。常用 Markdown 位于最上方，单个分类不应因项目较少而留下过大的空白区域。

### Deck 使用个人背景

- Deck 背景来源增加“使用个人背景”选项，默认关闭。
- 开启后动态读取当前账户的 `backgroundUrl`，不会复制或覆盖已有自定义 Deck 壁纸；未设置个人背景时禁用选项并显示提示。
- 选择自定义壁纸会自动关闭“使用个人背景”；旧用户的 `deck.wallpaper` 和默认行为保持不变。新增偏好缺失时由偏好 profile normalization 补默认值 `false`。
- 修改背景来源或壁纸后沿用现有行为，提示统一 reload 后应用。
- Deck 的个人背景应实际作为 Deck 根背景显示；“使用个人背景”与自定义壁纸选项之间保留清晰间距，避免两个设置控件粘连。
- 主要实现：
  - `packages/frontend/src/pages/settings/deck.vue`
  - `packages/frontend/src/ui/deck.vue`
  - `packages/frontend/src/ui/deck/column.vue`
  - `packages/frontend/src/preferences/def.ts`

维护注意事项：`$i` 是响应式账户对象但可能为 `null`；背景 URL 更新、账户切换和未登录 Deck 都应继续安全降级为无背景。合并上游时要保留根容器的背景样式与 column 阴影判断的同步更新。

## 待讨论：公开网盘分类

- 目标：在不修改原版网盘主要交互的前提下，为“他人可见”的文件提供独立入口或套壳。
- 尚未实现，不应把它当作当前版本功能；默认行为、公开范围、与现有文件夹的关系、个人资料入口、未登录访问和权限边界都需要先确定。

## Nix 后端测试环境（已实现）

- 新增锁定 nixpkgs 的 `flake.nix`，提供 Node.js 22、Corepack/pnpm、PostgreSQL 17、Redis 及 `re2`/`canvas` 所需的本地编译工具链（含 libuuid 运行库）。
- `sharkey-nix-test start|stop|status` 管理隔离的 PostgreSQL/Redis；默认使用 `.nix-test/`、55432/56379，不触碰系统服务或现有 `.config/test.yml`。
- `sharkey-nix-test prepare|unit|e2e` 会自动使用隔离测试配置并支持将尾随参数透传给 Jest；`unit` 会先构建 backend 前置产物和 backend、重建专用 `test-misskey` 数据库并执行迁移，`e2e` 会显式构建前置产物、backend 和 test-server 后直接运行 `jest:e2e`。干净 clone 需先执行 `pnpm install --frozen-lockfile`。
- 详细用法见 [`NIX_TESTING.md`](./NIX_TESTING.md)。
- Nix `dev` 测试实例的默认角色策略 `canSearchNotes` 为 `false`，搜索不可用时需在控制面板 → `Roles` → 基本角色/默认策略启用“是否可以搜索帖子”；这是测试环境配置，不修改生产默认策略。

## 验证与限制

- 当前验收使用 Nix devShell 的 Node.js `22.22.2`、pnpm `10.26.2`、PostgreSQL `17.10` 和 Redis `8.6.4`；`nix flake check --all-systems --no-build` 通过。
- backend workspace 中 `re2` 与 `canvas` 加载验证通过。
- ActivityPub unit 定向测试 48/48 通过。
- remote-reaction E2E 通过 2/2；这是使用 `testNamePattern` 的定向 E2E 选择，不代表完整 E2E 套件全部通过。
- 当前工作区 MFM 单元测试：`packages/frontend/test/mfm-function-picker.test.ts`，14/14 通过（Node.js 22 环境）。
- `git diff --check` 无输出。
- 全量 `vue-tsc` 目前会报告仓库既有的大量类型/依赖问题；本次改动文件未观察到对应新增错误，不能据此视为全量类型检查通过。
- 涉及 ActivityPub 或数据库的完整 E2E 测试需要 PostgreSQL 与 Redis 测试服务。
- 上游合并重点：locale 生成链（`sharkey-locales` → `locales/index.d.ts`）、偏好 profile normalization、MFM parser/renderer 参数表、Deck 响应式背景来源，以及新测试是否仍覆盖全部 cheatsheet 项。
