# Sinoport OS 构建产物治理 v1.0

## 1. 文档目的

本文件用于明确当前仓库里的构建产物边界，避免后续开发时反复出现“业务代码无变更，但工作区被大批静态文件打脏”的问题。

## 2. 当前现状

当前静态站发布流程会生成两类产物：

1. `admin-assets/`
2. 根目录静态路由目录下的 `index.html`

这些文件来自：

- [scripts/publish-admin-static.mjs](/Users/lijun/Downloads/Sinoport/scripts/publish-admin-static.mjs)
- [scripts/prepare-pages-site.mjs](/Users/lijun/Downloads/Sinoport/scripts/prepare-pages-site.mjs)

它们对于 Cloudflare Pages 发布是有效的，但会带来三个问题：

1. 日常开发时 `git status` 噪音很大
2. 构建一次就会出现大量 rename/delete/add
3. 容易把“发布产物变更”和“业务源码变更”混在一起

## 3. 建议策略

推荐采用 `CI / 临时目录生成`，不把这些构建产物作为日常开发的主提交对象。

建议原则：

1. `admin-console/src/`、`apps/`、`packages/` 才是主源码
2. `admin-assets/` 和根级静态路由文件只作为发布过程产物
3. 本地开发不要默认生成并保留这些产物
4. 发布时在临时 worktree 或 CI 中生成即可

## 4. 两种可选方案

### 方案 A：继续入库

适用场景：

- 你们希望仓库本身就是完整静态发布包
- 任何人拉代码后不依赖 CI 也能直接部署

缺点：

- 每次构建都会产生大量文件差异
- PR 会混入大量低信号静态产物

### 方案 B：改成临时产物

适用场景：

- 你们把 CI/CD 当作唯一正式发布入口
- 希望源码提交保持干净

优点：

- PR 更干净
- 更容易 review 真正的业务变更
- 降低误提交大批构建产物的概率

这是推荐方案。

## 5. 已落地方案

当前仓库已经采用“`CI / 临时目录生成`”方案，具体如下：

1. [publish-admin-static.mjs](/Users/lijun/Downloads/Sinoport/scripts/publish-admin-static.mjs) 默认把后台静态页输出到 `.generated/admin-static`
2. [prepare-pages-site.mjs](/Users/lijun/Downloads/Sinoport/scripts/prepare-pages-site.mjs) 从 `.generated/admin-static` 装配 `site-dist`
3. `site-dist` 继续作为 Pages 发布产物
4. `.generated/` 已加入 [/.gitignore](/Users/lijun/Downloads/Sinoport/.gitignore)
5. 现有 CI / release workflow 继续复用原命令，但默认不再把新产物写回仓库根目录

这意味着：

1. 新的默认发布流程已经不再污染主工作区
2. 历史遗留的根级 `admin-assets/` 与静态路由产物仍然存在，需要在单独清仓或一次性治理中处理
3. 以后若需要显式输出到其他目录，可通过 `PUBLISH_STATIC_OUTPUT_ROOT` 覆盖

## 6. 推荐下一步

1. 决定是否继续把 `admin-assets/` 和根级静态路由文件纳入版本管理
2. 如果选择“临时产物”：
   - 调整发布脚本输出目录
   - 调整 `.gitignore`
   - 让 CI / 发布工作流只从临时目录取文件
3. 以后把“发布产物提交”和“业务源码提交”分开

## 7. 当前结论

在当前仓库状态下，构建产物问题已经从“默认脚本持续污染主工作区”收口成“历史遗留产物仍待单独治理”。  
也就是说，`M2` 的默认生成链已经收口，但是否清理历史根级产物，仍需要单独安排一次仓库整理。
