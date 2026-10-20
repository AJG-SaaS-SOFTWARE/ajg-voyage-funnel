import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { validateUptimeHealth } from "../scripts/verify-uptime-health.mjs";

const good = () => ({ ok: true, service: "ajg-site-builder", database: "ok", environment: "production",
  deployment: { commitSha: "a".repeat(40), deploymentId: "dpl_fixture" }, private: "must not be printed" });
const script = new URL("../scripts/verify-uptime-health.mjs", import.meta.url);

for (const [index, value] of [null, {}, { ...good(), ok: "true" }, { ...good(), ok: false },
  { ...good(), service: "another-service" }, { ...good(), database: "unavailable" },
  { ...good(), environment: "preview" }, { ...good(), environment: null },
  { ...good(), deployment: null }, { ...good(), deployment: { commitSha: "a", deploymentId: "dpl_fixture" } },
  { ...good(), deployment: { commitSha: "a".repeat(40), deploymentId: "dpl_bad\n::error::injected" } }].entries()) {
  test(`uptime rejects unconfirmed application health case ${index}`, () => {
    assert.throws(() => validateUptimeHealth(value, "200"), /uptime_health_unconfirmed/);
  });
}

test("uptime requires exact HTTP200 and only returns safe evidence fields", () => {
  for (const status of [undefined, 200, "204", "301", "302", "307", "308", "401", "503"]) {
    assert.throws(() => validateUptimeHealth(good(), status));
  }
  const evidence = validateUptimeHealth(good(), "200");
  assert.equal(evidence.commitSha, "a".repeat(40));
  assert.equal(evidence.deploymentId, "dpl_fixture");
  assert.doesNotMatch(JSON.stringify(evidence), /must not be printed/);
});

test("CLI rejects HTML, malformed/oversized bodies and never leaks source details", () => {
  const dir = mkdtempSync(join(tmpdir(), "eltara-uptime-cli-")), file = join(dir,"health.json");
  const run = status => spawnSync(process.execPath, [script.pathname,file,status], { encoding:"utf8" });
  try {
    for (const body of ["<html>private login page</html>", '{"private":"private login page"',
      JSON.stringify({ ...good(), ok: false }), JSON.stringify({ ...good(), private: "x".repeat(16*1024) })]) {
      writeFileSync(file,body);
      const result = run("200");
      assert.equal(result.status,1); assert.equal(result.stdout,"");
      assert.equal(result.stderr,"ELTARA uptime health evidence is unconfirmed; validation failed.\n");
    }
    writeFileSync(file,JSON.stringify(good()));
    assert.equal(run("302").status,1);
    const passed = run("200");
    assert.equal(passed.status,0); assert.equal(JSON.parse(passed.stdout).ok,true);
    assert.doesNotMatch(passed.stdout,/must not be printed/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

function command(cmd, args, options) {
  return new Promise((resolve,reject) => {
    const child=spawn(cmd,args,options); let stdout="",stderr="";
    child.stdout.on("data",data=>stdout+=data); child.stderr.on("data",data=>stderr+=data);
    child.on("error",reject); child.on("close",status=>resolve({status,stdout,stderr}));
  });
}

test("actual uptime steps reject HTML200 and redirects with real isolated HTTP/curl", async () => {
  const workflow=readFileSync(new URL("../../.github/workflows/site-builder-uptime.yml",import.meta.url),"utf8");
  const blocks=["Check application and database health","Check ELTARA public domain"].map(name => {
    return workflow.split(`      - name: ${name}\n`)[1].split(/\n      - name:/)[0].split("        run: |\n")[1].replace(/^          /gm,"");
  });
  const dir=mkdtempSync(join(tmpdir(),"eltara-uptime-http-"));
  let status=200, body=JSON.stringify(good());
  const server=createServer((req,res)=>{ res.writeHead(status,{"Content-Type":"application/json","Location":"/login"}); res.end(body); });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    // Reproduce old curl-only false greens without any external request.
    for (const [code, content] of [[200,"<html>private login page</html>"],[302,JSON.stringify(good())]]) {
      status=code;body=content;
      assert.equal((await command("curl",["--fail","--silent",origin],{})).status,0);
      for (const [i,block] of blocks.entries()) {
        const fixture=block.replaceAll("https://ajg-site-builder.vercel.app",origin)
          .replaceAll("https://eltara.ajgsolutionsgroup.com",origin)
          .replaceAll("/tmp/eltara-uptime-app.json",join(dir,"app.json"))
          .replaceAll("/tmp/eltara-uptime-public.json",join(dir,"public.json"))
          .replaceAll("/tmp/eltara-hosts.txt",join(dir,"hosts"));
        const run=await command("bash",["-e","-c",'getent() { return 0; };\n'+fixture],{cwd:new URL("../../",import.meta.url)});
        assert.equal(run.status,1,`step${i}: ${run.stderr}`);
        assert.equal(run.stdout,""); assert.doesNotMatch(run.stderr,/private login page|must not be printed/);
      }
    }
    status=200;body=JSON.stringify(good());
    for (const block of blocks) {
      const fixture=block.replaceAll("https://ajg-site-builder.vercel.app",origin)
        .replaceAll("https://eltara.ajgsolutionsgroup.com",origin)
        .replaceAll("/tmp/eltara-uptime-app.json",join(dir,"app.json"))
        .replaceAll("/tmp/eltara-uptime-public.json",join(dir,"public.json"))
        .replaceAll("/tmp/eltara-hosts.txt",join(dir,"hosts"));
      const run=await command("bash",["-e","-c",'getent() { return 0; };\n'+fixture],{cwd:new URL("../../",import.meta.url)});
      assert.equal(run.status,0,run.stderr); assert.equal(JSON.parse(run.stdout).ok,true);
    }
    assert.match(workflow,/persist-credentials: false/);
    assert.match(workflow,/--connect-timeout 5 --max-time 15 --max-filesize 16384/);
    assert.doesNotMatch(blocks.join("\n"),/--location|\s-L\s/);
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); rmSync(dir,{recursive:true,force:true}); }
});
