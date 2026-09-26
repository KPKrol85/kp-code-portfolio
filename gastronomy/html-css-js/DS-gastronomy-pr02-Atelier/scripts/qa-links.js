const { htmlPages } = require("./build-config.js");

async function checkLinks() {
  const { LinkChecker, LinkState } = await import("linkinator");
  const external = process.argv.includes("--external");
  const origin = "http://127.0.0.1:5173/";
  const result = await new LinkChecker().check({
    path: [origin, ...htmlPages.map((page) => origin + page)],
    recurse: true,
    checkFragments: true,
    checkCss: true,
    concurrency: 4,
    timeout: 10000,
    linksToSkip: external ? [] : async (url) => new URL(url).origin !== new URL(origin).origin,
  });
  const broken = result.links.filter((link) => link.state === LinkState.BROKEN);
  broken.forEach((link) => console.error(`${link.status}: ${link.url} (from ${link.parent})`));
  console.log(`Links/assets/fragments: ${result.links.length} checked, ${broken.length} broken.`);
  if (!result.passed) process.exitCode = 1;
}

checkLinks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
