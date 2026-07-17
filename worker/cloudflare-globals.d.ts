interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  readonly __timeHeistD1Brand?: "D1Database";
}
