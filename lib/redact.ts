/**
 * Strips credentials out of text before it leaves the server.
 *
 * Provider SDKs and HTTP clients routinely embed the full request URL in their
 * error messages, and for Alchemy that URL *is* the credential —
 * `https://eth-mainnet.g.alchemy.com/v2/<API_KEY>`. Those messages were being
 * returned to the browser in the `details` field of our 500 responses, so any
 * visitor who could trigger an error could read the key straight out of the
 * network tab.
 *
 * Always run untrusted error text through this before putting it in a response.
 */
export function redactSecrets(text: string): string {
  let out = text;

  // The configured key itself, wherever it appears.
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (apiKey && apiKey.length > 6) {
    out = out.split(apiKey).join("***");
  }

  // Belt and braces: any RPC-style `/v2/<token>` path segment, in case a
  // different provider or a rotated key shows up in a message.
  out = out.replace(
    /(alchemy\.com|infura\.io|quiknode\.pro|g\.alchemy\.com)(\/v\d+)?\/[A-Za-z0-9_-]{8,}/gi,
    "$1$2/***"
  );

  return out;
}
