const http = require("http");
const net = require("net");
const { spawn } = require("child_process");

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: "127.0.0.1",
      port: 3000,
      path: path
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

function makeRawRequest(rawPath) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: 3000, host: "127.0.0.1" }, () => {
      client.write("GET " + rawPath + " HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
    });
    let response = "";
    client.on("data", data => response += data.toString());
    client.on("end", () => {
      const firstLine = (response.split(/\r?\n/)[0] || "").trim();
      const parts = firstLine.split(" ");
      const statusCode = parseInt(parts[1], 10) || 0;
      resolve({ statusCode, raw: response });
    });
    client.on("error", reject);
  });
}

(async () => {
  console.log("Starting server.cjs security test suite...");
  const server = spawn("node", ["server.cjs"], { stdio: "pipe" });

  await new Promise(resolve => setTimeout(resolve, 1000));

  let failed = false;

  try {
    const resRoot = await makeRequest("/");
    console.log("GET / -> Status:", resRoot.statusCode);
    if (resRoot.statusCode !== 200 || !resRoot.body.includes("BLEUUBOARD")) {
      console.error("FAIL: GET / should return 200 with index.html");
      failed = true;
    }

    const resV2 = await makeRequest("/v2");
    console.log("GET /v2 -> Status:", resV2.statusCode);
    if (resV2.statusCode !== 200) {
      console.error("FAIL: GET /v2 should return 200");
      failed = true;
    }

    const resTraversal = await makeRequest("/../../../../etc/passwd");
    console.log("GET /../../../../etc/passwd -> Status:", resTraversal.statusCode);
    if (resTraversal.body.includes("root:") || resTraversal.statusCode === 200) {
      console.error("FAIL: Path traversal attempt exposed system file!");
      failed = true;
    }

    const resEncoded = await makeRequest("/%2e%2e/%2e%2e/etc/passwd");
    console.log("GET /%2e%2e/%2e%2e/etc/passwd -> Status:", resEncoded.statusCode);
    if (resEncoded.body.includes("root:") || resEncoded.statusCode === 200) {
      console.error("FAIL: Encoded path traversal attempt exposed system file!");
      failed = true;
    }

    const resMalformed = await makeRawRequest("/%ff%ff");
    console.log("GET /raw-malformed-uri -> Status:", resMalformed.statusCode);
    if (resMalformed.statusCode !== 400) {
      console.error("FAIL: Malformed URI should return 400 Bad Request");
      failed = true;
    }

  } catch (err) {
    console.error("Test error:", err);
    failed = true;
  } finally {
    server.kill();
  }

  if (failed) {
    console.error("❌ Server security tests FAILED");
    process.exit(1);
  } else {
    console.log("✅ Server security tests PASSED");
    process.exit(0);
  }
})();
