/** CLI args without the leading "--" that `pnpm run <script> -- ...` passes through. */
export function cliArgs(): string[] {
  const args = process.argv.slice(2);
  return args[0] === "--" ? args.slice(1) : args;
}
