# 故事分析

> 按实际阅读范围拆解结构、节奏与读者信息，形成可定位、可复核、可接续创作的分析成果。

## 简介

河图洛书专业插件，维护固定阅读范围、分块覆盖、场景拆解、叙事信号、读者视角与问题。Codex经河图CLI/MCP操作，作者在独立工作面阅读、比较与反馈。

## 角色分流

- 作者与功能Review → [功能清单](CAPABILITIES.md)。
- Codex协作 → [包内Skill](skills/hetu-story-analysis/SKILL.md)。
- 开发与验收 → [docs](docs/README.md)。

## 快速上手

预构建运行包见[GitHub开发预览](https://github.com/wordflowlab/hetu-story-analysis/releases/tag/v0.1.0)。验证范围和已知超时见[验收记录](docs/08-实施计划与验收记录.md)。

Node.js 25与npm；构建在本目录执行：

```bash
npm ci
npm run build
npm run verify
npm run package
```

`dist/`通过河图公开插件生命周期入口安装；具体环境变量、安装与机器调试见[07](docs/07-开发发布与上架.md)。

跨插件依据要求宿主公开`hetu.extensions.objects.get`支持`owner_plugin_id`与固定`revision`；执行前发现实际Schema，验收环境见[08](docs/08-实施计划与验收记录.md)。

## 边界

本包维护专业成果，不持有第二套正文或正式设定，不内置模型和聊天。采纳、定稿、外发及费用按宿主独立合同决定；未知结果沿原键回读，冲突保留输入。
