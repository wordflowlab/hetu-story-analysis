# 专业流程

固定当前原稿或参考资料 → 建立阅读清单 → 分块拆解并记录覆盖 → 比较结构与读者视角 → 交给规划或审校 → 新稿影响复核。

采用参考作品隔离、分块恢复、结构拆解和多读者视角。信号来自外部Agent或作者声明，不把情绪标签当读者实际感受；不要求全书一次性进入模型，不引入内置生成循环。

## 执行与交接

新建`save_project`使用expected_revision=0、expected_sha256=""；更新固定旧修订与摘要。专业内容格式见包内`contracts/plugin-manifest.json`。`put_*`／`remove_*`维护单条记录，依赖存在时先处理依赖，不自动级联删除。

来源用宿主固定的document/resource/blueprint引用；证据包含source_index、UTF-8 byte_start/byte_end、逐字一致quote。引用外部资料时先由已获文件/网络访问权的Agent取证并经宿主归档，插件不抓网、不读取任意本机文件。

跨插件以`create_handoff`返回的basis_ref保存为下游basis_refs，同作品固定Owner/object/revision/sha256。只读引用不转移写Owner；旧结论不随上游新版漂移。将专业成果用于规划、候选、意见或返工，使用宿主及对应插件的实际能力；不直接操作其内部文件。

有界上下文明确max_chars，阅读返回的omitted_fields并按需补读；字符不是token费用。整书超出预算时按固定卷章分拆方案，记录未覆盖部分。正文/设定/采纳不由本插件决定。
