# 故事分析功能清单

本包拥有专业能力；宿主拥有正文、来源与作者决定。

| 动作 | 用途 | 必填参数 | 效果 |
| --- | --- | --- | --- |
| list_projects | 查找方案 |  | read |
| get_project | 读取固定方案 | object_id | read |
| save_project | 保存完整方案 | expected_revision, expected_sha256, operation_key, content | managed_write |
| put_segment | 维护分块阅读记录 | object_id, expected_revision, expected_sha256, operation_key, segment | managed_write |
| remove_segment | 移除分块记录 | object_id, expected_revision, expected_sha256, operation_key, segment_id | managed_write |
| put_scene | 维护场景拆解 | object_id, expected_revision, expected_sha256, operation_key, scene | managed_write |
| remove_scene | 移除无依赖场景 | object_id, expected_revision, expected_sha256, operation_key, scene_id | managed_write |
| put_signal | 维护叙事信号 | object_id, expected_revision, expected_sha256, operation_key, signal | managed_write |
| remove_signal | 移除信号 | object_id, expected_revision, expected_sha256, operation_key, signal_id | managed_write |
| put_reader_view | 维护读者视角 | object_id, expected_revision, expected_sha256, operation_key, reader_view | managed_write |
| remove_reader_view | 移除读者视角 | object_id, expected_revision, expected_sha256, operation_key, reader_view_id | managed_write |
| put_finding | 维护分析问题 | object_id, expected_revision, expected_sha256, operation_key, finding | managed_write |
| remove_finding | 移除问题 | object_id, expected_revision, expected_sha256, operation_key, finding_id | managed_write |
| get_coverage | 计算真实字节覆盖与缺口 | object_id | read |
| get_structure | 读取固定场景与信号投影 | object_id | read |
| preview_update | 预览新来源的复核影响 | object_id, replacements | read |
| build_analysis_context | 准备有界分析上下文 | object_id, goal, max_chars | read |
| create_handoff | 生成固定专业交接 | object_id, goal | read |
| get_source | 读取固定依据 | object_id, source_index | read |
| get_basis | 读取固定上游成果 | object_id, basis_index | read |
| compare_versions | 比较专业修订 | object_id, from_revision, to_revision | read |
| export_project | 导出固定成果 | object_id, format | read |
| get_operation | 回读原操作 | operation_key | read |

默认流程、边界及验收见 [docs](docs/README.md)。
