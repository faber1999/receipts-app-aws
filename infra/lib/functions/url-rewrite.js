// Runs on every viewer request at the edge (CloudFront Functions, runtime cloudfront-js-2.0).
// Maps clean URLs from the Next.js static export to their .html files in S3.
// biome-ignore lint/correctness/noUnusedVariables: CloudFront invokes handler() by name.
function handler(event) {
  const request = event.request;
  const uri = request.uri;
  const lastSegment = uri.split('/').pop() ?? '';

  if (uri !== '/' && !lastSegment.includes('.')) {
    request.uri = `${uri.replace(/\/$/, '')}.html`;
  }

  return request;
}
