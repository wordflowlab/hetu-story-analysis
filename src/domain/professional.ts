import { requireValue as need } from "../../vendor/project-store.ts";
import { span, sourceText, uniqueIds } from "./text.ts";
export const fields = {
  segment: "segments",
  scene: "scenes",
  signal: "signals",
  reader_view: "reader_views",
  finding: "findings",
};
export const defaults = () => ({
  scope_indices: [],
  segments: [],
  scenes: [],
  signals: [],
  reader_views: [],
  findings: [],
});
export function validateDomain(p: any) {
  uniqueIds(p.scope_indices.map(String), "阅读范围重复。");
  const scenes = new Set(p.scenes.map((x: any) => x.id));
  for (const v of [...p.segments, ...p.scenes]) {
    need(
      p.scope_indices.includes(v.source_index),
      "分块和场景必须属于声明的阅读范围。",
    );
    need(v.byte_end > v.byte_start, "阅读和场景范围须非空。");
    if (v.status === "done") need(v.summary.trim(), "已读分块须记录摘要。");
  }
  for (const s of p.scenes)
    for (const e of s.evidence)
      need(
        e.source_index === s.source_index &&
          e.byte_start >= s.byte_start &&
          e.byte_end <= s.byte_end,
        "场景证据必须属于该场景范围。",
      );
  for (const s of p.signals)
    need(scenes.has(s.scene_id), "信号引用的场景不存在。");
  for (const v of [...p.reader_views, ...p.findings]) {
    uniqueIds(v.scene_ids, "场景引用重复。");
    for (const id of v.scene_ids) need(scenes.has(id), "引用的场景不存在。");
  }
  for (const f of p.findings) {
    uniqueIds(f.recheck_source_indices.map(String), "复核来源重复。");
    if (f.status === "addressed") {
      need(
        f.resolution.trim() && f.recheck_source_indices.length,
        "已处理问题须有复核解释和新来源。",
      );
      need(
        f.recheck_source_indices.every(
          (i: number) =>
            !p.scope_indices.includes(i) &&
            !f.evidence.some((e: any) => e.source_index === i),
        ),
        "复核须使用区别于旧分析范围的新来源。",
      );
    }
  }
}
export async function checkSources(p: any, sources: any[]) {
  for (const s of [...p.segments, ...p.scenes])
    span(sourceText(sources[s.source_index]), s.byte_start, s.byte_end);
}
export function coverage(p: any, sources: any[]) {
  const rows = p.scope_indices.map((i: number) => {
    const total = new TextEncoder().encode(sourceText(sources[i])).length,
      ranges = p.segments
        .filter((s: any) => s.source_index === i && s.status === "done")
        .map((s: any) => [s.byte_start, s.byte_end])
        .sort((a: number[], b: number[]) => a[0] - b[0]),
      merged: number[][] = [];
    for (const [a, b] of ranges) {
      const last = merged.at(-1);
      if (last && a <= last[1]) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    let at = 0;
    const gaps: number[][] = [];
    for (const [a, b] of merged) {
      if (a > at) gaps.push([at, a]);
      at = b;
    }
    if (at < total) gaps.push([at, total]);
    const read = merged.reduce((n, [a, b]) => n + b - a, 0);
    return {
      source_index: i,
      total_bytes: total,
      read_bytes: read,
      coverage: total ? read / total : null,
      gaps,
      failed: p.segments
        .filter((s: any) => s.source_index === i && s.status === "failed")
        .map((s: any) => s.id),
    };
  });
  const total = rows.reduce((n: any, r: any) => n + r.total_bytes, 0),
    read = rows.reduce((n: any, r: any) => n + r.read_bytes, 0);
  return {
    sources: rows,
    total_bytes: total,
    read_bytes: read,
    coverage: total ? read / total : null,
    complete: total > 0 && read === total,
    note: "覆盖证明固定字节范围已登记阅读分析，不保证分析质量或作者认可。",
  };
}
export function structure(p: any) {
  return {
    scenes: [...p.scenes]
      .sort(
        (a, b) =>
          p.scope_indices.indexOf(a.source_index) -
            p.scope_indices.indexOf(b.source_index) ||
          a.byte_start - b.byte_start,
      )
      .map((s) => ({
        ...s,
        signals: p.signals.filter((x: any) => x.scene_id === s.id),
      })),
    reader_views: p.reader_views,
    findings: p.findings,
    note: "信号与读者视角是Agent或作者的分析，不是实际读者调研。",
  };
}
export function update(p: any, sources: any[], replacements: any[]) {
  uniqueIds(
    replacements.map((x) => String(x.old_source_index)),
    "同一旧来源不能重复指定替代。",
  );
  return {
    applied: false,
    replacements: replacements.map((x) => {
      need(
        p.scope_indices.includes(x.old_source_index) &&
          sources[x.new_source_index] &&
          x.old_source_index !== x.new_source_index,
        "更新来源必须是当前范围及另一个已固定来源。",
      );
      sourceText(sources[x.new_source_index]);
      const scenes = p.scenes
        .filter((s: any) => s.source_index === x.old_source_index)
        .map((s: any) => s.id);
      return {
        ...x,
        segments: p.segments
          .filter((s: any) => s.source_index === x.old_source_index)
          .map((s: any) => s.id),
        scenes,
        signals: p.signals
          .filter((s: any) => scenes.includes(s.scene_id))
          .map((s: any) => s.id),
        reader_views: p.reader_views
          .filter((s: any) =>
            s.scene_ids.some((id: string) => scenes.includes(id)),
          )
          .map((s: any) => s.id),
        findings: p.findings
          .filter(
            (s: any) =>
              s.scene_ids.some((id: string) => scenes.includes(id)) ||
              s.evidence.some(
                (e: any) => e.source_index === x.old_source_index,
              ),
          )
          .map((s: any) => s.id),
      };
    }),
    note: "这是影响预览。旧范围、坐标和结论保持原固定修订；新稿须重新阅读与分析。",
  };
}
export function readProfessional(
  action: string,
  p: any,
  sources: any[],
  i: any,
): any {
  if (action === "get_coverage") return coverage(p, sources);
  if (action === "get_structure") return structure(p);
  if (action === "preview_update") return update(p, sources, i.replacements);
}
export function contextProject(p: any, _i: any) {
  return structure(p);
}
