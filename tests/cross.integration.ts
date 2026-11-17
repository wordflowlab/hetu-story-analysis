import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { start } from "./support/machine.ts";
import { original, scenario, selection, base } from "./support/scenario.ts";
import { importText } from "./support/import.ts";
import { candidate } from "./support/creative.ts";
const root = path.resolve("..");
test(
  "同一小说：研究→人物→分析→卷章规划→候选→审校→新稿影响",
  { timeout: 600000 },
  async (t) => {
    const c = await start();
    t.diagnostic(c.directory);
    let serial = 0;
    try {
      async function attach(slug: string) {
        const directory = path.join(root, slug, "dist"),
          m = JSON.parse(
            await readFile(path.join(directory, "plugin.json"), "utf8"),
          ),
          pkg = await c.ok("hetu_plugins_inspect_package", {
            package_directory: directory,
          });
        await c.ok("hetu_plugins_apply", {
          action: "install",
          plugin_id: m.id,
          package_directory: directory,
          package_sha256: pkg.package_sha256,
          expected_sha256: (await c.ok("hetu_plugins_inspect")).state_sha256,
          authorization_note: "本地隔离作品跨插件验收",
          operation_key: "cross-install-" + ++serial,
        });
        const binding = {
          management_ref: c.management,
          work_ref: c.work,
          plugin_id: m.id,
          package_sha256: pkg.package_sha256,
        };
        const invoke = async (action: string, input: any) => {
          const cap = await c.ok("hetu_plugins_capabilities", binding);
          const out = await c.ok("hetu_plugins_invoke", {
            ...binding,
            capabilities_sha256: cap.capabilities_sha256,
            action,
            arguments: input,
          });
          assert.equal(
            out.result.status,
            "succeeded",
            JSON.stringify(out.result),
          );
          return out.result.data;
        };
        return { invoke, m, pkg };
      }
      const research = await attach("hetu-story-research"),
        characters = await attach("hetu-character-lab"),
        planner = await attach("hetu-novel-planner"),
        review = await attach("hetu-novel-review");
      await c.discover();
      const refs = await importText(c, [original]);
      const project = async (slug: string) =>
        (
          await import(
            pathToFileURL(path.join(root, slug, "tests/support/scenario.ts"))
              .href
          )
        ).scenario();
      const create = (api: any, p: any, key: string) =>
        api.invoke("save_project", {
          content: p,
          source_refs: refs,
          expected_revision: 0,
          expected_sha256: "",
          operation_key: key,
        });
      let r = await create(
        research,
        await project("hetu-story-research"),
        "cross-research",
      );
      const hr = await research.invoke("create_handoff", {
        ...selection(r),
        goal: "据此研究人物动机",
      });
      const cp = await project("hetu-character-lab");
      cp.basis_refs = [hr.basis_ref];
      const cr = await create(characters, cp, "cross-character");
      assert.equal(
        (
          await characters.invoke("get_basis", {
            ...selection(cr),
            basis_index: 0,
          })
        ).basis.sha256,
        r.sha256,
      );
      const hc = await characters.invoke("create_handoff", {
        ...selection(cr),
        goal: "拆解人物行动与叙事承诺",
      });
      const ap = scenario();
      ap.basis_refs = [hr.basis_ref, hc.basis_ref];
      let ar = await create(c, ap, "cross-analysis");
      assert.equal(
        (await c.invoke("get_basis", { ...selection(ar), basis_index: 1 }))
          .basis.sha256,
        cr.sha256,
      );
      const ha = await c.invoke("create_handoff", {
        ...selection(ar),
        goal: "让下一章从等待转为寻找",
      });
      r = await research.invoke("save_project", {
        ...base(r, "research-v2"),
        content: { ...r.object.content, title: "研究已迭代的新版本" },
      });
      assert.equal(
        (
          await characters.invoke("get_basis", {
            ...selection(cr),
            basis_index: 0,
          })
        ).basis.sha256,
        hr.basis_ref.sha256,
      );
      const models: any = await import(
        pathToFileURL(path.join(root, "hetu-novel-planner/src/domain/model.ts"))
          .href
      );
      const plan = models.newPlan("雨港来信 · 续作规划", "book");
      plan.author_constraints =
        "保留寄件人悬念，林溪由等待转为主动寻找。固定专业依据：" +
        JSON.stringify([hr.basis_ref, hc.basis_ref, ha.basis_ref]);
      let pr = await planner.invoke("put_plan", {
        title: "雨港来信 · 续作规划",
        content: plan,
        source_refs: refs,
        expected_revision: 0,
        expected_sha256: "",
        operation_key: "cross-plan",
      });
      const planRecord = pr.object ? pr : (pr.plan ?? pr);
      assert.ok(planRecord.object, JSON.stringify(pr));
      pr = planRecord;
      const vol = models.newNode("volume", "第一卷 雨港旧事", "vol");
      pr = await planner.invoke("insert_node", {
        ...base(pr, "cross-volume"),
        parent_id: "book",
        node: vol,
      });
      const chapter = models.newNode("chapter", "第二章 没有署名的来信", "ch2");
      pr = await planner.invoke("insert_node", {
        ...base(pr, "cross-chapter"),
        parent_id: "vol",
        node: chapter,
      });
      const detail = models.newDetail(pr.object.object_id, "ch2");
      detail.goal = "让林溪采取寻找行动";
      detail.summary = "由等待转向寻找，未知寄件人保留为悬念";
      detail.notes = JSON.stringify(ha.basis_ref);
      const dr = await planner.invoke("put_detail", {
        title: "第二章 规划卡",
        content: detail,
        source_refs: refs,
        expected_revision: 0,
        expected_sha256: "",
        operation_key: "cross-detail",
      });
      await planner.invoke("attach_object", {
        ...base(pr, "cross-attach"),
        node_id: "ch2",
        role: "detail",
        target: {
          object_id: dr.object.object_id,
          revision: dr.object.revision,
          sha256: dr.sha256,
        },
      });
      const generated = await candidate(
        c,
        "林溪把最后一只邮袋放上桌面。她不再等了，先去找那封没有署名的信。\n",
        "cross-candidate",
      );
      const reviewModel: any = await import(
        pathToFileURL(path.join(root, "hetu-novel-review/src/domain/model.ts"))
          .href
      );
      const rp = {
        ...reviewModel.newProject("雨港来信 · 候选审校"),
        scope_indices: [0, 1],
      };
      const rr = await review.invoke("save_project", {
        content: rp,
        source_refs: [...refs, generated.source_ref],
        expected_revision: 0,
        expected_sha256: "",
        operation_key: "cross-review",
      });
      await review.invoke("put_issue", {
        ...base(rr, "cross-issue"),
        issue: {
          id: "motivation",
          title: "确认人物主动寻找是否符合本章目标",
          domain: "characters",
          severity: "suggestion",
          description:
            "候选完成行动转折，仍需作者审阅。固定分析依据：" +
            JSON.stringify(ha.basis_ref),
          evidence: [
            { source_index: 1, byte_start: 0, byte_end: 6, quote: "林溪" },
          ],
          disposition: "open",
          candidate_source_index: 1,
          resolution: "",
          resolution_source_indices: [],
        },
      });
      ar = await c.invoke("save_project", {
        ...base(ar, "cross-new-source"),
        source_refs: [...refs, generated.source_ref],
        content: ar.object.content,
      });
      const impact = await c.invoke("preview_update", {
        ...selection(ar),
        replacements: [{ old_source_index: 0, new_source_index: 1 }],
      });
      assert.equal(impact.applied, false);
      assert.deepEqual(impact.replacements[0].findings, ["f1"]);
      assert.equal(
        (await c.invoke("get_coverage", selection(ar))).read_bytes,
        Buffer.byteLength(original),
      );
      assert.ok(
        (
          await c.ok("hetu_read_creative_task", {
            task_ref: generated.task.task_ref,
          })
        ).submission,
      );
      await writeFile(
        "docs/research/cross-plugin-acceptance.json",
        JSON.stringify(
          {
            date: new Date().toISOString(),
            directory: c.directory,
            source_build: true,
            upstream_packages: [
              research.m.id,
              characters.m.id,
              planner.m.id,
              review.m.id,
            ],
            stages: [
              "research",
              "characters",
              "analysis",
              "book-volume-chapter",
              "candidate",
              "review",
              "new-source-impact",
            ],
            fixed_basis: [hr.basis_ref, hc.basis_ref, ha.basis_ref],
            old_basis_survived_upstream_revision: true,
            adopted: false,
            finalized: false,
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      await c.client.close();
    }
  },
);
