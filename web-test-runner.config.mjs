const port = Number.parseInt(process.env.WTR_PORT ?? '2000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`WTR_PORT must be a valid TCP port, got: ${process.env.WTR_PORT}`);
}

export default {
  nodeResolve: true,
  port,
  testRunnerHtml: (testFramework) => `
    <html>
      <body>
        <script type="module" src="/test/helpers/setup-config.js"></script>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>
  `,
};
