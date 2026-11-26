export default async () => {
  const started = Date.now();

  const result = {
    proxy: "online",
    supabase: "unknown",
    latency_ms: null,
    upstream_status: null
  };

  try {
    const response = await fetch(
      "https://cdiunbffdbyzmmthehic.supabase.co/auth/v1/health",
      {
        signal: AbortSignal.timeout(8000),
        redirect: "error"
      }
    );

    result.upstream_status = response.status;
    result.supabase = response.ok || response.status === 401
      ? "reachable"
      : "unexpected_response";
  } catch {
    result.supabase = "unreachable";
  }

  result.latency_ms = Date.now() - started;

  return new Response(JSON.stringify(result, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
};
