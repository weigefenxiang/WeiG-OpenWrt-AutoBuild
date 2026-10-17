#!/usr/bin/env node
// Normalized execution evidence shared by the build, Run summary and Issue reply.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const clean = value => String(value || '').replace(/\x1b\[[0-9;]*m/g, '')
  .replace(/\$[156y]\$[^\s'"`]+/g, '[redacted hash]').replace(/[\r\n|`<>]/g, ' ').slice(0, 500);
const rules = [
  ['rootfs-capacity', /ext4_allocate[^:]*:.*out of space|failed to allocate \d+ blocks, out of space|(?:mkfs\.ext4|make_ext4fs|mksquashfs|rootfs)[^\n]*(?:not enough space|too (?:big|large)|out of space)/i,
    'RootFS 容量不足 / RootFS capacity exceeded', '在目标支持可调分区时增大 Target Images → TARGET_ROOTFS_PARTSIZE；固定闪存机型应减少软件。 / Increase the configurable RootFS partition only where supported; reduce packages on fixed-flash devices.'],
  ['image-capacity', /(?:image|kernel|firmware)[^\n]*(?:is too (?:big|large)|exceeds?[^\n]*(?:limit|size)|does not fit)/i,
    '镜像超过机型容量 / Device image capacity exceeded', '核对机型闪存与分区上限，减少软件；不要盲目扩大固定分区。 / Check the device flash layout and reduce packages; do not enlarge fixed partitions blindly.'],
  ['runner-disk', /no space left on device|disk quota exceeded/i,
    '编译主机磁盘空间不足 / Runner disk exhausted', '检查 Runner 磁盘使用；这不等于 RootFS 分区不足。 / Inspect runner disk usage; this is not proof of a small RootFS partition.'],
  ['runner-memory', /(?:killed signal terminated program cc1|out of memory|oom-kill|cannot allocate memory)/i,
    '编译主机内存不足 / Runner memory exhausted', '检查内存证据并降低编译并发。 / Check memory evidence and reduce compile concurrency.'],
];

export function classifyBuildEvidence({ stages = [], config = '', compile = {}, diagnostic = {} } = {}) {
  const findings = [];
  for (const { stage, log } of stages) {
    for (const line of String(log || '').split(/\r?\n/)) {
      // V=s prints recipes as well as failures; never classify a rendered echo.
      if (/\b(?:echo|printf)\b.*(?:ERROR|error|out of space|too (?:big|large))/i.test(line)) continue;
      const rule = rules.find(([, pattern]) => pattern.test(line));
      if (rule && !findings.some(row => row.code === rule[0] && row.stage === stage)) {
        findings.push({ code: rule[0], title: rule[2], advice: rule[3], stage, evidence: clean(line) });
      }
    }
  }
  const timeout = [compile, diagnostic].some(row => String(row.exitCode) === '124');
  const interrupted = [compile, diagnostic].some(row => row.outcome === 'cancelled');
  const recovered = compile.outcome === 'failure' && diagnostic.outcome === 'success';
  return { schema: 1, rootfsMiB: /^(?:CONFIG_)?TARGET_ROOTFS_PARTSIZE=(\d+)\s*$/m.exec(config)?.[1] || null,
    compile, diagnostic, timeout, interrupted, recovered, findings };
}

export function resolveBuildResult({ report = {}, jobs = [], annotations = [], buildResult, publishResult } = {}) {
  const build = jobs.find(row => /^Build \/|^Build$/.test(row.name || ''));
  const timeoutMessage = annotations.map(row => String(row.message || '')).find(message =>
    /exceeded the maximum execution time|execution time limit|job timed out/i.test(message));
  let code = 'build-failed', title = '构建失败 / Build failed';
  if (timeoutMessage || report.timeout || build?.conclusion === 'timed_out') {
    code = 'execution-timeout'; title = '构建执行超时 / Build execution timed out';
  } else if (buildResult === 'cancelled' || report.interrupted || build?.conclusion === 'cancelled') {
    code = 'interrupted'; title = '构建已取消或中断 / Build cancelled or interrupted';
  } else if (buildResult === 'success' && ['success', 'skipped'].includes(publishResult)) {
    code = 'success'; title = '构建完成 / Build completed';
  } else if (buildResult === 'success') {
    code = 'publication-failed'; title = '固件发布未完成 / Firmware publication incomplete';
  }
  const duration = timeoutMessage?.match(/maximum execution time of ([\dhms]+)/i)?.[1];
  return { schema: 1, code, title, limit: duration || null, platformEvidence: clean(timeoutMessage),
    stage: build?.steps?.find(row => ['failure', 'cancelled', 'timed_out'].includes(row.conclusion))?.name || '',
    report };
}

export function renderBuildResult(result, { runUrl = '', artifactRef = '' } = {}) {
  const { report = {} } = result;
  const lines = [`## ${result.code === 'success' ? '✅' : '⚠️'} ${result.title}`, ''];
  if (result.limit) lines.push(`- 本次 job 配置上限 / Configured job limit: **${clean(result.limit)}**`);
  if (result.code === 'execution-timeout') lines.push('- GitHub 托管 Runner 单 job 硬上限为 6 小时；项目可配置更短上限。超时本身不证明软件包不兼容。 / GitHub-hosted jobs have a 6-hour ceiling; a project may set a shorter limit. Timeout alone does not prove package incompatibility.');
  if (report.executionBudgetSeconds > 0) lines.push(`- 本次执行预算 / Execution budget: **${Math.round(report.executionBudgetSeconds / 60)} min**（包含准备阶段 / includes preparation）`);
  if (result.stage) lines.push(`- 阶段 / Stage: ${clean(result.stage)}`);
  for (const finding of report.findings || []) {
    lines.push('', `### ${finding.title}`, `- 证据 / Evidence (${clean(finding.stage)}): \`${clean(finding.evidence)}\``, `- ${finding.advice}`);
  }
  if (report.rootfsMiB) lines.push(`- 当前 RootFS / Current RootFS: **${report.rootfsMiB} MiB**`);
  if (report.recovered) lines.push('- 并行失败后，单线程重试成功。 / The single-thread retry recovered the parallel failure.');
  if (result.code === 'execution-timeout' && report.compile?.outcome === 'failure' && String(report.compile.exitCode) !== '124') {
    lines.push('- 超时前已有并行编译错误，请同时查看 parallel/ 原始现场；不能只归因于超时。 / A parallel failure preceded the timeout; also inspect the original parallel/ evidence.');
  }
  if (runUrl) lines.push('', `[Actions / 本次构建](${runUrl})`);
  if (artifactRef) lines.push(`下载 / Downloads: \`${clean(artifactRef)}-CONFIG\` · \`${clean(artifactRef)}-BUILD-LOGS\`。固件见本次 Run 的下载指南。 / See the firmware download guide in this Run.`);
  return lines.join('\n') + '\n';
}

export async function publishBuildResult({ github, context, env = process.env }) {
  const owner = context.repo.owner, repo = context.repo.repo;
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, { owner, repo, run_id: context.runId, filter: 'latest', per_page: 100 });
  const annotations = [];
  for (const job of jobs.filter(row => /^Build \/|^Build$/.test(row.name || ''))) {
    try { annotations.push(...await github.paginate(github.rest.checks.listAnnotations, { owner, repo, check_run_id: job.id, per_page: 100 })); }
    catch { /* Report unknown interruption rather than inventing a timeout. */ }
  }
  const path = join('build-result', 'build-result.json');
  const report = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const result = resolveBuildResult({ jobs, annotations, report, buildResult: env.BUILD_RESULT, publishResult: env.PUBLISH_RESULT });
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const body = renderBuildResult(result, { runUrl, artifactRef: env.ARTIFACT_REF });
  appendFileSync(env.GITHUB_STEP_SUMMARY, body);
  await github.rest.issues.createComment({ owner, repo, issue_number: Number(env.ISSUE_NUMBER), body: `@${env.REQUESTER}\n\n${body}` });
  await github.rest.issues.update({ owner, repo, issue_number: Number(env.ISSUE_NUMBER), state: 'closed', state_reason: result.code === 'success' ? 'completed' : 'not_planned' });
}

function main() {
  const directory = resolve(process.argv[2] || 'failure-logs');
  const text = path => existsSync(path) ? readFileSync(path, 'utf8') : '';
  const stages = ['parallel', 'diagnostic'].map(stage => ({ stage, log: text(join(directory, stage, 'errors.txt')) }));
  const report = classifyBuildEvidence({ stages, config: text('openwrt/.config'),
    compile: { outcome: process.env.COMPILE_OUTCOME, exitCode: process.env.COMPILE_EXIT },
    diagnostic: { outcome: process.env.DIAGNOSTIC_OUTCOME, exitCode: process.env.DIAGNOSTIC_EXIT } });
  report.executionBudgetSeconds = Number(process.env.BUILD_EXECUTION_BUDGET_SECONDS || 0);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'build-result.json'), JSON.stringify(report, null, 2) + '\n');
  const result = report.compile.outcome === 'success' || report.recovered
    ? { code: 'compile-complete', title: '编译完成；最终发布结果见 Run / Compile complete; see the Run for publication status', report }
    : resolveBuildResult({ report });
  const summary = renderBuildResult(result, { artifactRef: process.env.ARTIFACT_REF });
  writeFileSync(join(directory, '00-SUMMARY.txt'), summary);
  console.log(summary);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
